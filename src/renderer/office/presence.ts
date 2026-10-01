import type { WorkState } from '../../domain/events';
import {
  DESKS,
  DOOR_QUEUE,
  SOUTH_GATE,
  type Facing,
  type Waypoint,
  type Zone,
  type ZonedPoint,
  arrivalPath,
  gridFor,
  placeConsultant,
  routeTo,
  waypointFor,
} from './landmarks';
import { assignLeisure, cellKey, leisureKey, LEISURE_DEFS, LEISURE_ZONE, type LeisureKind } from './leisure';
import { BOOT_MS, STANDBY_MS, monitorPhase, type MonitorPhase } from './monitor-phase';
import { cellAt } from './world-layout';

export const WALK_PX_PER_SEC = 150;
/** Quiet time after the last work_observed before an idle consultant leaves. Domain lease stays 24h. */
export const ABSENCE_MS = 15 * 60_000;
const ARRIVE_EPSILON = 0.5;

export type PresenceMode = 'arrive' | 'work' | 'toLeisure' | 'leisure' | 'toDesk' | 'hold' | 'overflow' | 'depart';

type Desired = 'work' | 'leisure' | 'hold';

export interface PresenceConsultant {
  id: string;
  workState: WorkState;
  ambientEligible: boolean;
  /** Epoch ms of the last work_observed. Absence is measured from this, not from entering leisure. */
  lastObservedAt?: number;
  /** Presence id of the parent. Set on a collaborator. */
  parentId?: string;
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
  /** Ms since the last work_observed. Null when the clock was never set. Departure stays at 15 minutes. */
  quietMs: number | null;
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
  leisureCol: number;
  leisureRow: number;
  /** Door-queue slot, or -1 when this body is not waiting by the door. */
  queueIndex: number;
  /** Leisure was full, so the body stays off the canvas instead of joining a standing grid. */
  benched: boolean;
  moving: boolean;
  bootMs: number;
  leaveMs: number;
  desired: Desired;
  lastObservedAt: number | null;
  /** True while one of this consultant's collaborators is active. */
  departBlocked: boolean;
  /** Cell the renderer errand is walking to. Empty when the body is not on an errand. */
  aimKey: string;
}

/**
 * Session-local presence. "Have I seen this id?" lives here, not in the reducer.
 * First active sight walks in from the gate. A later idle→active walks back from
 * wherever they are. Stale freezes in place. Every walk is a route on the nav grid.
 */
export class PresenceDirector {
  private readonly agents = new Map<string, Agent>();
  /** Ids that walked out the gate and stay gone until work_observed brings them back. */
  private readonly away = new Set<string>();
  /** Renderer errand goals. Ignored unless the body is idle at leisure. */
  private aims: ReadonlyMap<string, Waypoint> = new Map();

  setAims(goals: ReadonlyMap<string, Waypoint>): void {
    this.aims = goals;
  }

  sync(consultants: readonly PresenceConsultant[], now = 0): void {
    const live = new Set(consultants.map((c) => c.id));
    for (const id of [...this.agents.keys()]) {
      if (!live.has(id)) this.agents.delete(id);
    }
    for (const id of [...this.away]) {
      if (!live.has(id)) this.away.delete(id);
    }

    const blocked = blockedParents(consultants);
    for (const consultant of consultants) {
      const desired = desiredOf(consultant);
      const existing = this.agents.get(consultant.id);
      const clock = {
        lastObservedAt: consultant.lastObservedAt !== undefined ? consultant.lastObservedAt : null,
        departBlocked: blocked.has(consultant.id),
      };
      if (!existing) {
        if (this.away.has(consultant.id) && desired !== 'work') continue;
        if (desired === 'work') this.away.delete(consultant.id);
        if (desired !== 'work' && quiet(consultant, now)) {
          this.away.add(consultant.id);
          continue;
        }
        const desk = desired === 'leisure' ? null : this.freeDesk(consultant.id);
        const agent = spawn(consultant.id, desired, desk, this.agents, clock);
        if (!agent) continue;
        this.agents.set(consultant.id, agent);
        if (wantsToLeave(agent, now)) beginDepart(agent);
        continue;
      }
      existing.desired = desired;
      existing.lastObservedAt = clock.lastObservedAt;
      existing.departBlocked = clock.departBlocked;
      if (existing.deskIndex < 0 && desired === 'work') {
        const freed = this.freeDesk(consultant.id);
        if (freed !== null) {
          existing.deskIndex = freed;
          existing.desk = DESKS[freed]!;
          existing.queueIndex = -1;
          existing.benched = false;
          existing.mode = 'toDesk';
          existing.path = routeTo(existing, existing.desk);
          existing.bootMs = 0;
          continue;
        }
      }
      if (wantsToLeave(existing, now)) {
        if (existing.mode !== 'depart') beginDepart(existing);
        continue;
      }
      if (existing.mode === 'depart' && existing.departBlocked && desired === 'leisure') {
        returnToLeisure(existing);
        continue;
      }
      transition(existing, desired, this.agents);
    }
  }

  step(deltaMs: number, reducedMotion: boolean, now = 0): PresenceSnapshot[] {
    const seconds = Math.max(0, deltaMs) / 1000;
    const snapshots: PresenceSnapshot[] = [];

    for (const agent of this.agents.values()) {
      if (agent.desired === 'hold' && absent(agent, now)) {
        this.away.add(agent.id);
        this.agents.delete(agent.id);
        continue;
      }
      if (wantsToLeave(agent, now)) {
        if (agent.mode !== 'depart') beginDepart(agent);
      } else if (agent.mode === 'depart' && agent.departBlocked && agent.desired === 'leisure') {
        returnToLeisure(agent);
      }
      followAim(agent, reducedMotion ? undefined : this.aims.get(agent.id), reducedMotion);
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

      if (agent.mode === 'depart' && agent.path.length === 0 && !agent.moving) {
        if (atGate(agent)) {
          this.away.add(agent.id);
          this.agents.delete(agent.id);
          continue;
        }
        agent.path = routeTo(agent, SOUTH_GATE);
      }

      if (agent.benched) continue;

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
          mode: seatMode(agent.mode),
          bootMs: agent.bootMs,
          leaveMs: agent.leaveMs,
          atDesk: here,
        }),
        deskIndex: agent.deskIndex,
        mode: agent.mode,
        leisure: agent.mode === 'leisure' && !agent.moving ? agent.leisureKind : null,
        leisureMotion: agent.mode === 'leisure' && !agent.moving && !reducedMotion,
        quietMs: agent.lastObservedAt === null ? null : Math.max(0, now - agent.lastObservedAt),
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

function heading(mode: PresenceMode): Desired | 'out' {
  if (mode === 'depart') return 'out';
  if (mode === 'arrive' || mode === 'toDesk' || mode === 'work' || mode === 'overflow') return 'work';
  if (mode === 'toLeisure' || mode === 'leisure') return 'leisure';
  return 'hold';
}

function quiet(consultant: PresenceConsultant, now: number): boolean {
  return consultant.lastObservedAt !== undefined && now - consultant.lastObservedAt >= ABSENCE_MS;
}

function absent(agent: Agent, now: number): boolean {
  if (agent.lastObservedAt === null) return false;
  return now - agent.lastObservedAt >= ABSENCE_MS;
}

function wantsToLeave(agent: Agent, now: number): boolean {
  return agent.desired === 'leisure' && !agent.departBlocked && absent(agent, now);
}

function beginDepart(agent: Agent): void {
  agent.mode = 'depart';
  agent.bootMs = 0;
  agent.leaveMs = 0;
  agent.path = routeTo(agent, SOUTH_GATE);
}

function returnToLeisure(agent: Agent): void {
  agent.mode = 'toLeisure';
  agent.leaveMs = 0;
  agent.bootMs = 0;
  agent.path = routeTo(agent, agent.leisure);
}

function blockedParents(consultants: readonly PresenceConsultant[]): Set<string> {
  const blocked = new Set<string>();
  for (const consultant of consultants) {
    if (consultant.parentId !== undefined && consultant.workState === 'active') blocked.add(consultant.parentId);
  }
  return blocked;
}

function seatMode(mode: PresenceMode): 'arrive' | 'work' | 'toLeisure' | 'leisure' | 'toDesk' | 'hold' {
  if (mode === 'overflow' || mode === 'depart') return 'leisure';
  return mode;
}

function atPoint(agent: Agent, goal: { x: number; y: number; zone: Zone }): boolean {
  return agent.zone === goal.zone && Math.hypot(agent.x - goal.x, agent.y - goal.y) < 12;
}

/**
 * Walk an idle body toward a renderer errand. Reduced motion drops the path and holds still.
 * Work, stale, and departure keep the path presence already chose.
 */
function followAim(agent: Agent, goal: Waypoint | undefined, reducedMotion: boolean): void {
  const eligible = agent.mode === 'leisure' && agent.desired === 'leisure' && !reducedMotion;
  if (!goal || !eligible) {
    if (agent.aimKey && agent.mode === 'leisure' && agent.desired === 'leisure') agent.path = [];
    agent.aimKey = '';
    return;
  }
  const key = `${goal.zone}:${Math.round(goal.x)}:${Math.round(goal.y)}:${goal.facing}`;
  if (agent.aimKey === key) {
    if (agent.path.length === 0 && atPoint(agent, goal)) agent.facing = goal.facing;
    return;
  }
  agent.aimKey = key;
  if (atPoint(agent, goal)) {
    agent.path = [];
    agent.facing = goal.facing;
    return;
  }
  agent.path = routeTo(agent, goal);
}

function atGate(agent: Agent): boolean {
  return agent.zone === SOUTH_GATE.zone
    && Math.hypot(agent.x - SOUTH_GATE.x, agent.y - SOUTH_GATE.y) < 12;
}

function spawn(
  id: string,
  desired: Desired,
  deskIndex: number | null,
  others: Map<string, Agent>,
  clock: { lastObservedAt: number | null; departBlocked: boolean },
): Agent | null {
  const place = placeConsultant(id);
  const queueIndex = desired === 'work' && deskIndex === null ? claimQueue(others) : -1;
  if (desired === 'work' && deskIndex === null && queueIndex < 0) return null;

  const needsLeisure = desired === 'leisure' || (desired === 'hold' && deskIndex === null);
  const slot = needsLeisure ? claimLeisure(id, others) : null;
  if (needsLeisure && !slot) return null;

  const leisureDef = slot ?? LEISURE_DEFS[0]!;
  const leisure = waypointFor(leisureDef);
  const seated = deskIndex !== null;
  const desk = DESKS[deskIndex ?? 0]!;
  const queue = queueIndex >= 0 ? DOOR_QUEUE[queueIndex]! : null;
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
    leisureKind: leisureDef.kind,
    leisureCol: leisureDef.col,
    leisureRow: leisureDef.row,
    queueIndex,
    benched: false,
    moving: false,
    bootMs: 0,
    leaveMs: 0,
    desired,
    lastObservedAt: clock.lastObservedAt,
    departBlocked: clock.departBlocked,
    aimKey: '',
  };

  if (queue) {
    agent.mode = 'overflow';
    agent.zone = queue.zone;
    agent.x = queue.x;
    agent.y = queue.y;
    agent.facing = 'south';
  } else if (desired === 'work') {
    const gate = stepOff(place.gate, others);
    agent.mode = 'arrive';
    agent.zone = place.gate.zone;
    agent.x = gate.x;
    agent.y = gate.y;
    agent.facing = 'north';
    agent.path = arrivalPath({ ...place.gate, x: gate.x, y: gate.y }, desk);
  } else if (desired === 'leisure') {
    const at = stepOff(leisure, others);
    agent.mode = 'leisure';
    agent.zone = leisure.zone;
    agent.x = at.x;
    agent.y = at.y;
    agent.facing = leisure.facing;
  }

  return agent;
}

function claimQueue(others: Map<string, Agent>): number {
  const taken = new Set([...others.values()].map((agent) => agent.queueIndex).filter((index) => index >= 0));
  for (let i = 0; i < DOOR_QUEUE.length; i += 1) if (!taken.has(i)) return i;
  return -1;
}

function stepOff(point: { x: number; y: number; zone: Zone }, others: Map<string, Agent>): { x: number; y: number } {
  let x = point.x;
  let y = point.y;
  for (let i = 0; i < 8; i += 1) {
    const crowded = [...others.values()].some((agent) => (
      agent.zone === point.zone && Math.hypot(agent.x - x, agent.y - y) < 12
    ));
    if (!crowded) return { x, y };
    y -= 16;
  }
  return { x: point.x, y: point.y };
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
  if (!slot) {
    agent.benched = true;
    agent.deskIndex = -1;
    agent.queueIndex = -1;
    agent.path = [];
    agent.moving = false;
    return;
  }
  agent.benched = false;
  agent.leisure = waypointFor(slot);
  agent.leisureKind = slot.kind;
  agent.leisureCol = slot.col;
  agent.leisureRow = slot.row;
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
    if (agent.id === except) continue;
    if (agent.deskIndex >= 0 && heading(agent.mode) !== 'leisure') {
      const seat = cellAt(agent.desk.x, agent.desk.y);
      taken.add(`${agent.desk.zone}:${seat.col},${seat.row}`);
    }
    const usesLeisure = heading(agent.mode) === 'leisure' || (agent.mode === 'hold' && agent.deskIndex < 0);
    if (!usesLeisure) continue;
    const def = { kind: agent.leisureKind, col: agent.leisureCol, row: agent.leisureRow };
    taken.add(leisureKey({ ...def, facing: agent.leisure.facing }));
    taken.add(cellKey(def));
  }
  return assignLeisure(id, taken, (def) => gridFor(LEISURE_ZONE[def.kind]).walkable(def.col, def.row));
}

function atDesk(agent: Agent): boolean {
  if (agent.deskIndex < 0 || agent.zone !== agent.desk.zone) return false;
  return Math.hypot(agent.x - agent.desk.x, agent.y - agent.desk.y) < 12;
}

function facingFrom(dx: number, dy: number): Facing {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}
