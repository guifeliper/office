import type { Waypoint, Facing } from './landmarks';
import type { PresenceSnapshot } from './presence';
import { ABSENCE_MS } from './presence';
import type { ErrandPose } from './consultant-view';
import { armchairSeat } from './cabin-layout';
import { butterflyAway, type FlightPoint } from './butterflies';
import { cellCenter } from './world-layout';
import { initialWood, stepWood, woodPose, type WoodState } from './wood-cycle';
import { initialPet, stepPet, petPose, type PetState } from './pet-cycle';
import { BUG_REACH, initialBug, stepBug, bugPose, chaseDue, type BugState } from './bug-cycle';
import { initialSleep, stepSleep, sleepPose, maySleep, type SleepState } from './sleep-cycle';
import { STATIONS, pickOne, stationKey, stationWaypoint } from './errand-stations';

const TILE = 16;
const HERE = 12;

interface Run<T> {
  state: T;
  home: Waypoint;
}

interface BugRun extends Run<BugState> {
  flight: number;
}

export interface ErrandAdvance {
  snaps: readonly PresenceSnapshot[];
  deltaMs: number;
  reduced: boolean;
  now: number;
  butterflies: readonly FlightPoint[];
  blocked: (x: number, y: number) => boolean;
}

/**
 * Who is on a renderer errand, and where they should walk.
 * Active and stale snaps never enter. Reduced motion freezes a run and does not start one.
 */
export class ErrandBoard {
  private wood = new Map<string, Run<WoodState>>();
  private pet = new Map<string, Run<PetState>>();
  private bug = new Map<string, BugRun>();
  private sleep = new Map<string, Run<SleepState>>();
  private displaced: { index: number; x: number; y: number } | null = null;

  ids(): { wood: string | null; pet: string | null; bug: string | null; sleep: string | null } {
    return {
      wood: first(this.wood),
      pet: first(this.pet),
      bug: first(this.bug),
      sleep: first(this.sleep),
    };
  }

  /** Goals for this frame. Empty while motion is reduced, so nobody paths. */
  aims(snaps: readonly PresenceSnapshot[], reduced: boolean, butterflies: readonly FlightPoint[]): Map<string, Waypoint> {
    const goals = new Map<string, Waypoint>();
    if (reduced) return goals;
    const byId = index(snaps);
    for (const [id, run] of this.wood) {
      const snap = byId.get(id);
      if (!snap || snap.mode !== 'leisure') continue;
      const goal = woodGoal(run);
      if (goal) goals.set(id, goal);
    }
    for (const [id, run] of this.pet) {
      const snap = byId.get(id);
      if (!snap || snap.mode !== 'leisure') continue;
      const goal = petGoal(run);
      if (goal) goals.set(id, goal);
    }
    for (const [id, run] of this.sleep) {
      const snap = byId.get(id);
      if (!snap || snap.mode !== 'leisure') continue;
      const goal = sleepGoal(run);
      if (goal) goals.set(id, goal);
    }
    for (const [id, run] of this.bug) {
      const snap = byId.get(id);
      if (!snap || snap.mode !== 'leisure') continue;
      const goal = bugGoal(run, snap, butterflies);
      if (goal) goals.set(id, goal);
    }
    return goals;
  }

  advance(input: ErrandAdvance): void {
    const byId = index(input.snaps);
    this.stepRuns(byId, input);
    if (input.reduced) return;
    this.startRuns(byId, input);
  }

  pose(id: string, play: boolean): ErrandPose | null {
    const wood = this.wood.get(id);
    if (wood) return woodPose(wood.state, play);
    const pet = this.pet.get(id);
    if (pet) return petPose(pet.state, play);
    const bug = this.bug.get(id);
    if (bug) return bugPose(bug.state, play);
    const sleep = this.sleep.get(id);
    if (!sleep) return null;
    const posed = sleepPose(sleep.state, play);
    if (!posed) return null;
    return { ...posed, at: armchairSeat() };
  }

  /** Scare point for one butterfly. Null leaves it on its route. The sprite stays. */
  butterflyAt(index: number): FlightPoint | null {
    if (!this.displaced || this.displaced.index !== index) return null;
    return { x: this.displaced.x, y: this.displaced.y };
  }

  private stepRuns(byId: Map<string, PresenceSnapshot>, input: ErrandAdvance): void {
    for (const [id, run] of [...this.wood]) {
      const snap = leisure(byId, id);
      if (!snap) {
        this.wood.delete(id);
        continue;
      }
      const goal = woodGoal(run);
      run.state = stepWood(run.state, input.deltaMs, goal ? at(snap, goal) : false, input.reduced);
    }
    for (const [id, run] of [...this.pet]) {
      const snap = leisure(byId, id);
      if (!snap) {
        this.pet.delete(id);
        continue;
      }
      const goal = petGoal(run);
      run.state = stepPet(run.state, input.deltaMs, goal ? at(snap, goal) : false, input.reduced);
    }
    for (const [id, run] of [...this.sleep]) {
      const snap = leisure(byId, id);
      if (!snap) {
        this.sleep.delete(id);
        continue;
      }
      const goal = sleepGoal(run);
      run.state = stepSleep(run.state, input.deltaMs, goal ? at(snap, goal) : false, input.reduced);
    }
    for (const [id, run] of [...this.bug]) {
      const snap = leisure(byId, id);
      if (!snap) {
        this.bug.delete(id);
        if (this.displaced?.index === run.flight) this.displaced = null;
        continue;
      }
      const point = input.butterflies[run.flight];
      const near = point !== undefined && Math.hypot(snap.x - point.x, snap.y - point.y) <= BUG_REACH;
      const before = run.state.phase;
      run.state = stepBug(run.state, input.deltaMs, near, input.reduced);
      if (before !== 'flee' && run.state.phase === 'flee' && point) {
        const away = butterflyAway(point, snap, input.blocked);
        this.displaced = { index: run.flight, x: away.x, y: away.y };
      }
      if (run.state.phase === 'back' && at(snap, run.home)) {
        this.bug.delete(id);
        if (this.displaced?.index === run.flight) this.displaced = null;
      } else if (run.state.phase !== 'flee' && this.displaced?.index === run.flight) {
        this.displaced = null;
      }
    }
  }

  private startRuns(byId: Map<string, PresenceSnapshot>, input: ErrandAdvance): void {
    const snaps = [...byId.values()];
    if (this.sleep.size === 0) {
      const candidates = snaps.filter((snap) => cabinIdle(snap) && maySleep(snap.quietMs, ABSENCE_MS) && !this.pet.has(snap.id));
      const id = pickOne(candidates.map((snap) => snap.id), 'sleep');
      const snap = id ? byId.get(id) : undefined;
      if (id && snap) this.sleep.set(id, { state: initialSleep(), home: homeOf(snap) });
    }
    if (this.pet.size === 0) {
      const candidates = snaps.filter((snap) => cabinIdle(snap) && !this.sleep.has(snap.id));
      const id = pickOne(candidates.map((snap) => snap.id), 'pet');
      const snap = id ? byId.get(id) : undefined;
      if (id && snap) this.pet.set(id, { state: initialPet(), home: homeOf(snap) });
    }
    if (this.wood.size === 0) {
      const candidates = snaps.filter((snap) => snap.mode === 'leisure' && snap.leisure === 'woodpile' && !snap.moving && !this.bug.has(snap.id));
      const id = pickOne(candidates.map((snap) => snap.id), 'wood');
      const snap = id ? byId.get(id) : undefined;
      if (id && snap) this.wood.set(id, { state: initialWood(), home: homeOf(snap) });
    }
    if (this.bug.size === 0 && input.butterflies.length > 0) {
      const woodId = first(this.wood);
      const candidates = snaps.filter((snap) => (
        snap.mode === 'leisure'
        && !snap.moving
        && snap.zone === 'yard'
        && (snap.leisure === 'garden' || snap.leisure === 'woodpile')
        && snap.id !== woodId
        && chaseDue(snap.id, input.now)
      ));
      const id = pickOne(candidates.map((snap) => snap.id), 'bug');
      const snap = id ? byId.get(id) : undefined;
      const flight = id && snap ? pickFlight(input.butterflies, snaps, id) : null;
      if (id && snap && flight !== null) this.bug.set(id, { state: initialBug(), home: homeOf(snap), flight });
    }
  }
}

function first<T>(map: Map<string, T>): string | null {
  for (const id of map.keys()) return id;
  return null;
}

function index(snaps: readonly PresenceSnapshot[]): Map<string, PresenceSnapshot> {
  return new Map(snaps.map((snap) => [snap.id, snap]));
}

function leisure(byId: Map<string, PresenceSnapshot>, id: string): PresenceSnapshot | null {
  const snap = byId.get(id);
  if (!snap || snap.mode !== 'leisure') return null;
  return snap;
}

function cabinIdle(snap: PresenceSnapshot): boolean {
  return snap.mode === 'leisure' && !snap.moving && snap.zone === 'cabin' && (snap.leisure === 'hearth' || snap.leisure === 'coffee');
}

function homeOf(snap: PresenceSnapshot): Waypoint {
  return { x: snap.x, y: snap.y, facing: snap.facing, zone: snap.zone };
}

function at(snap: PresenceSnapshot, goal: Waypoint): boolean {
  return snap.zone === goal.zone && !snap.moving && Math.hypot(snap.x - goal.x, snap.y - goal.y) < HERE;
}

function woodGoal(run: Run<WoodState>): Waypoint | null {
  const phase = run.state.phase;
  if (phase === 'approach' || phase === 'chop' || phase === 'lift') return stationWaypoint(STATIONS.stump);
  if (phase === 'haul' || phase === 'drop') return stationWaypoint(STATIONS.pile);
  if (phase === 'return') return run.home;
  return null;
}

function petGoal(run: Run<PetState>): Waypoint | null {
  if (run.state.phase === 'go' || run.state.phase === 'pet') return stationWaypoint(STATIONS.pet);
  if (run.state.phase === 'back') return run.home;
  return null;
}

function sleepGoal(run: Run<SleepState>): Waypoint | null {
  if (run.state.phase === 'go' || run.state.phase === 'doze') return stationWaypoint(STATIONS.sleep);
  return null;
}

function bugGoal(run: BugRun, snap: PresenceSnapshot, butterflies: readonly FlightPoint[]): Waypoint | null {
  if (run.state.phase === 'back') return run.home;
  if (run.state.phase !== 'chase') return null;
  const point = butterflies[run.flight];
  if (!point) return null;
  const col = Math.floor(point.x / TILE);
  const row = Math.floor(point.y / TILE);
  return { ...cellCenter({ col, row }), facing: facingTo(snap, point), zone: 'yard' };
}

function facingTo(from: { x: number; y: number }, to: { x: number; y: number }): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

function pickFlight(butterflies: readonly FlightPoint[], snaps: readonly PresenceSnapshot[], selfId: string): number | null {
  const taken = new Set(Object.values(STATIONS).map(stationKey));
  const self = snaps.find((snap) => snap.id === selfId);
  if (!self) return null;
  for (const snap of snaps) {
    if (snap.id === selfId) continue;
    taken.add(`${snap.zone}:${Math.floor(snap.x / TILE)},${Math.floor(snap.y / TILE)}`);
  }
  let best = -1;
  let bestDist = Infinity;
  butterflies.forEach((point, index) => {
    const key = `yard:${Math.floor(point.x / TILE)},${Math.floor(point.y / TILE)}`;
    if (taken.has(key)) return;
    const dist = Math.hypot(point.x - self.x, point.y - self.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best >= 0 ? best : null;
}
