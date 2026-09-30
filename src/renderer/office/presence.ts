import type { WorkState } from '../../domain/events';
import {
  DESKS,
  type Facing,
  type Waypoint,
  type Zone,
  type ZonedPoint,
  arrivalPath,
  placeConsultant,
  routeTo,
  waypointFor,
} from './landmarks';
import { assignLeisure, leisureKey, type LeisureKind } from './leisure';
import { BOOT_MS, STANDBY_MS, monitorPhase, type MonitorPhase } from './monitor-phase';
import { cellAt } from './world-layout';

export const WALK_PX_PER_SEC = 150;
const ARRIVE_EPSILON = 0.5;

export type PresenceMode = 'arrive' | 'work' | 'toLeisure' | 'leisure' | 'toDesk' | 'hold' | 'overflow';

type Desired = 'work' | 'leisure' | 'hold';

export interface PresenceConsultant {
  id: string;
  workState: WorkState;
  ambientEligible: boolean;
}

export interface PresenceSnapshot {
  id: string;
  /** Which scene the body is in. The renderer draws it only there. */
  zone: Zone;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  /** Subtle work bob. False while walking, idle, stale, or reduced motion. */
  bob: boolean;
  /** Sit while the feet are at the desk and the consultant is not walking. */
  pose: 'sit' | 'stand';
  monitor: MonitorPhase;
  deskIndex: number;
  /** `hold` is stale. The badge shows it; the body stays opaque. */
  mode: PresenceMode;
  /** Set only while idle and standing at a leisure slot. Stale never sets this. */
  leisure: LeisureKind | null;
  /** False for reduced motion, walking, or stale. */
  leisureMotion: boolean;
}

interface Agent {
  id: string;
  mode: PresenceMode;
  zone: Zone;
  x: number;
  y: number;
  facing: Facing;
  path: ZonedPoint[];
  deskIndex: number;
  desk: Waypoint;
  leisure: Waypoint;
  leisureKind: LeisureKind;
  moving: boolean;
  bootMs: number;
  leaveMs: number;
}

/**
 * Session-local presence. "Have I seen this id?" lives here, not in the reducer.
 * First active sight walks in from the gate. A later idle→active walks back from
 * wherever they are. Stale freezes in place. Every walk is a route on the nav grid.
 */
export class PresenceDirector {
  private readonly agents = new Map<string, Agent>();

  sync(consultants: readonly PresenceConsultant[]): void {
    const live = new Set(consultants.map((c) => c.id));
    for (const id of [...this.agents.keys()]) {
      if (!live.has(id)) this.agents.delete(id);
    }

    for (const consultant of consultants) {
      const desired = desiredOf(consultant);
      const existing = this.agents.get(consultant.id);
      if (!existing) {
        this.agents.set(consultant.id, spawn(consultant.id, desired, this.freeDesk(consultant.id), this.agents));
        continue;
      }
      if (existing.deskIndex < 0 && desired === 'work') {
        const freed = this.freeDesk(consultant.id);
        if (freed !== null) {
          existing.deskIndex = freed;
          existing.desk = DESKS[freed]!;
          existing.mode = 'toDesk';
          existing.path = routeTo(existing, existing.desk);
          existing.bootMs = 0;
          continue;
        }
      }
      transition(existing, desired, this.agents);
    }
  }

  step(deltaMs: number, reducedMotion: boolean): PresenceSnapshot[] {
    const seconds = Math.max(0, deltaMs) / 1000;
    const snapshots: PresenceSnapshot[] = [];

    for (const agent of this.agents.values()) {
      agent.moving = false;
      if (reducedMotion) {
        if (agent.mode === 'toLeisure' && agent.path.length === 0) {
          agent.leaveMs = 0;
          agent.path = routeTo(agent, agent.leisure);
        }
        if (agent.path.length > 0) {
          const last = agent.path[agent.path.length - 1]!;
          agent.x = last.x;
          agent.y = last.y;
          agent.zone = last.zone;
          agent.path = [];
        }
        finish(agent);
        agent.bootMs = 0;
        agent.leaveMs = 0;
      } else {
        if (agent.mode === 'work' && agent.bootMs > 0) {
          agent.bootMs = Math.max(0, agent.bootMs - deltaMs);
        }
        let walkSeconds = seconds;
        if (agent.mode === 'toLeisure' && agent.leaveMs > 0) {
          const wait = Math.min(walkSeconds, agent.leaveMs / 1000);
          agent.leaveMs = Math.max(0, agent.leaveMs - wait * 1000);
          walkSeconds -= wait;
          if (agent.leaveMs <= 0) agent.path = routeTo(agent, agent.leisure);
        }
        let remaining = walkSeconds * WALK_PX_PER_SEC;
        while (agent.path.length > 0) {
          const target = agent.path[0]!;
          if (target.zone !== agent.zone) {
            // Through the door: the body leaves one scene and appears at the other door.
            agent.zone = target.zone;
            agent.x = target.x;
            agent.y = target.y;
            agent.path.shift();
            continue;
          }
          const dx = target.x - agent.x;
          const dy = target.y - agent.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= ARRIVE_EPSILON) {
            agent.x = target.x;
            agent.y = target.y;
            agent.path.shift();
            continue;
          }
          if (remaining <= 0) break;
          if (dist <= remaining) {
            agent.x = target.x;
            agent.y = target.y;
            remaining -= dist;
            agent.path.shift();
            continue;
          }
          agent.x += (dx / dist) * remaining;
          agent.y += (dy / dist) * remaining;
          agent.facing = facingFrom(dx, dy);
          agent.moving = true;
          break;
        }
        if (!agent.moving) {
          const arriving = agent.mode === 'arrive' || agent.mode === 'toDesk';
          finish(agent);
          if (arriving && agent.mode === 'work' && remaining > 0) {
            agent.bootMs = Math.max(0, agent.bootMs - (remaining / WALK_PX_PER_SEC) * 1000);
          }
        }
      }

      const here = atDesk(agent);
      snapshots.push({
        id: agent.id,
        zone: agent.zone,
        x: agent.x,
        y: agent.y,
        facing: agent.facing,
        moving: agent.moving,
        bob: agent.mode === 'work' && !reducedMotion,
        pose: here && !agent.moving && (agent.mode === 'work' || agent.mode === 'hold' || (agent.mode === 'toLeisure' && agent.leaveMs > 0))
          ? 'sit'
          : 'stand',
        monitor: monitorPhase({
          mode: agent.mode === 'overflow' ? 'leisure' : agent.mode,
          bootMs: agent.bootMs,
          leaveMs: agent.leaveMs,
          atDesk: here,
        }),
        deskIndex: agent.deskIndex,
        mode: agent.mode,
        leisure: agent.mode === 'leisure' && !agent.moving ? agent.leisureKind : null,
        leisureMotion: agent.mode === 'leisure' && !agent.moving && !reducedMotion,
      });
    }

    return snapshots;
  }

  /**
   * Next free desk in the shared pool of 12. Consultants and collaborators
   * take from the same pool. Null when every chair is taken: the arrival
   * stands at leisure instead of sharing a seat or standing on the parent.
   */
  private freeDesk(id: string): number | null {
    const preferred = placeConsultant(id).deskIndex;
    const taken = new Set(
      [...this.agents.values()].map((agent) => agent.deskIndex).filter((index) => index >= 0),
    );
    for (let i = 0; i < DESKS.length; i += 1) {
      const index = (preferred + i) % DESKS.length;
      if (!taken.has(index)) return index;
    }
    return null;
  }
}

function desiredOf(consultant: PresenceConsultant): Desired {
  if (consultant.workState === 'stale') return 'hold';
  if (consultant.workState === 'active') return 'work';
  if (consultant.ambientEligible) return 'leisure';
  return 'hold';
}

function heading(mode: PresenceMode): Desired {
  if (mode === 'arrive' || mode === 'toDesk' || mode === 'work' || mode === 'overflow') return 'work';
  if (mode === 'toLeisure' || mode === 'leisure') return 'leisure';
  return 'hold';
}

function spawn(id: string, desired: Desired, deskIndex: number | null, others: Map<string, Agent>): Agent {
  const place = placeConsultant(id);
  const seated = deskIndex !== null;
  const desk = DESKS[deskIndex ?? 0]!;
  const slot = claimLeisure(id, others);
  const leisure = waypointFor(slot);
  const agent: Agent = {
    id,
    mode: 'hold',
    zone: seated ? desk.zone : leisure.zone,
    x: seated ? desk.x : leisure.x,
    y: seated ? desk.y : leisure.y,
    facing: seated ? desk.facing : leisure.facing,
    path: [],
    deskIndex: deskIndex ?? -1,
    desk,
    leisure,
    leisureKind: slot.kind,
    moving: false,
    bootMs: 0,
    leaveMs: 0,
  };

  if (desired === 'work') {
    agent.mode = 'arrive';
    agent.zone = place.gate.zone;
    agent.x = place.gate.x;
    agent.y = place.gate.y;
    agent.facing = 'north';
    agent.path = arrivalPath(place.gate, seated ? desk : leisure);
  } else if (desired === 'leisure') {
    agent.mode = 'leisure';
    agent.x = leisure.x;
    agent.y = leisure.y;
    agent.facing = leisure.facing;
  }

  return agent;
}

function transition(agent: Agent, desired: Desired, others: Map<string, Agent>): void {
  if (heading(agent.mode) === desired) return;

  if (desired === 'hold') {
    agent.mode = 'hold';
    agent.path = [];
    agent.moving = false;
    return;
  }

  if (desired === 'work') {
    agent.mode = 'toDesk';
    agent.path = routeTo(agent, agent.desk);
    return;
  }

  const slot = claimLeisure(agent.id, others, agent.id);
  agent.leisure = waypointFor(slot);
  agent.leisureKind = slot.kind;
  agent.mode = 'toLeisure';
  agent.bootMs = 0;
  agent.leaveMs = STANDBY_MS;
  agent.path = [];
}

function finish(agent: Agent): void {
  if (agent.path.length > 0) return;
  if (agent.mode === 'arrive' || agent.mode === 'toDesk') {
    if (agent.deskIndex < 0) {
      agent.mode = 'overflow';
      agent.facing = agent.leisure.facing;
      agent.bootMs = 0;
      return;
    }
    agent.mode = 'work';
    agent.facing = agent.desk.facing;
    agent.bootMs = BOOT_MS;
    return;
  }
  if (agent.mode === 'toLeisure') {
    if (agent.leaveMs > 0) return;
    agent.mode = 'leisure';
    agent.facing = agent.leisure.facing;
  }
}

function claimLeisure(id: string, others: Map<string, Agent>, except?: string): ReturnType<typeof assignLeisure> {
  const taken = new Set<string>();
  for (const agent of others.values()) {
    const standingThere = heading(agent.mode) === 'leisure' || agent.deskIndex < 0;
    if (agent.id === except || !standingThere) continue;
    const cell = cellAt(agent.leisure.x, agent.leisure.y);
    taken.add(leisureKey({
      kind: agent.leisureKind,
      col: cell.col,
      row: cell.row,
      facing: agent.leisure.facing,
    }));
  }
  return assignLeisure(id, taken);
}

function atDesk(agent: Agent): boolean {
  if (agent.deskIndex < 0 || agent.zone !== agent.desk.zone) return false;
  return Math.hypot(agent.x - agent.desk.x, agent.y - agent.desk.y) < 12;
}

function facingFrom(dx: number, dy: number): Facing {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}
