/**
 * Courtyard monarchs. Each one wanders slowly around its own flower.
 * Flights are pure data built once from a seed; the scene moves the sprites.
 */

export interface FlightPoint {
  x: number;
  y: number;
}

export interface FlightLeg {
  from: FlightPoint;
  to: FlightPoint;
  startMs: number;
  /** Rest on `from` before flying. */
  pauseMs: number;
  flyMs: number;
  /** Side-to-side flutter, in pixels, across the leg. */
  wobble: number;
  /** Flutter waves along the leg. */
  waves: number;
}

export interface ButterflyFlight {
  home: FlightPoint;
  legs: readonly FlightLeg[];
  periodMs: number;
}

/** Pixels per second. A tile is 16 px, so this is under one tile a second. */
export const BUTTERFLY_SPEED_MIN = 8;
export const BUTTERFLY_SPEED_MAX = 14;
export const BUTTERFLY_WANDER = 72;
export const BUTTERFLY_FRAME_MS = 140;
/** Wings beat slowly while resting. */
export const BUTTERFLY_REST_FRAME_MS = 420;
const MAX_FLIGHTS = 5;
const MIN_HOME_GAP = 160;
const LEGS = 32;
const HOP_MIN = 18;
const HOP_MAX = 56;

export function butterflyFlights(
  perches: readonly FlightPoint[],
  blocked: (x: number, y: number) => boolean,
): ButterflyFlight[] {
  const open = perches
    .filter((point) => !blocked(point.x, point.y))
    .sort((a, b) => hash(a.x, a.y) - hash(b.x, b.y));
  const homes: FlightPoint[] = [];
  for (const point of open) {
    if (homes.length >= MAX_FLIGHTS) break;
    if (homes.some((other) => Math.hypot(other.x - point.x, other.y - point.y) < MIN_HOME_GAP)) continue;
    homes.push(point);
  }
  return homes.map((home) => wander(home, blocked));
}

function wander(home: FlightPoint, blocked: (x: number, y: number) => boolean): ButterflyFlight {
  const rand = rng(hash(home.x, home.y));
  const legs: FlightLeg[] = [];
  let at = home;
  let clock = 0;
  for (let i = 0; i < LEGS; i += 1) {
    // The last leg flies home so the loop closes without a jump.
    const to = i === LEGS - 1 ? home : nextStop(at, home, rand, blocked);
    const dist = Math.hypot(to.x - at.x, to.y - at.y);
    const speed = BUTTERFLY_SPEED_MIN + rand() * (BUTTERFLY_SPEED_MAX - BUTTERFLY_SPEED_MIN);
    const leg: FlightLeg = {
      from: at,
      to,
      startMs: clock,
      pauseMs: 900 + Math.floor(rand() * 3600),
      flyMs: Math.max(1, Math.round((dist / speed) * 1000)),
      wobble: dist < 4 ? 0 : 2 + rand() * 4,
      waves: Math.max(1, Math.round(dist / 18)),
    };
    legs.push(leg);
    clock += leg.pauseMs + leg.flyMs;
    at = to;
  }
  return { home, legs, periodMs: clock };
}

/** A short hop in a random direction, pulled back toward home when it strays. */
function nextStop(
  at: FlightPoint,
  home: FlightPoint,
  rand: () => number,
  blocked: (x: number, y: number) => boolean,
): FlightPoint {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const angle = rand() * Math.PI * 2;
    const hop = HOP_MIN + rand() * (HOP_MAX - HOP_MIN);
    let x = at.x + Math.cos(angle) * hop;
    let y = at.y + Math.sin(angle) * hop;
    const away = Math.hypot(x - home.x, y - home.y);
    if (away > BUTTERFLY_WANDER) {
      x = home.x + ((x - home.x) / away) * BUTTERFLY_WANDER * rand();
      y = home.y + ((y - home.y) / away) * BUTTERFLY_WANDER * rand();
    }
    const to = { x: Math.round(x), y: Math.round(y) };
    if (!blocked(to.x, to.y) && !segmentBlocked(at, to, blocked)) return to;
  }
  return at;
}

function segmentBlocked(from: FlightPoint, to: FlightPoint, blocked: (x: number, y: number) => boolean): boolean {
  for (let step = 1; step <= 4; step += 1) {
    const t = step / 4;
    if (blocked(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)) return true;
  }
  return false;
}

/**
 * A point farther from the chaser. The flight itself is left alone.
 * If every step is blocked, the butterfly stays where it is.
 */
export function butterflyAway(
  at: FlightPoint,
  from: FlightPoint,
  blocked: (x: number, y: number) => boolean,
): FlightPoint {
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const dist = 48;
  const options = [
    { x: at.x + (dx / len) * dist, y: at.y + (dy / len) * dist },
    { x: at.x + (-dy / len) * dist, y: at.y + (dx / len) * dist },
    { x: at.x + (dy / len) * dist, y: at.y + (-dx / len) * dist },
  ];
  return options.find((point) => !blocked(point.x, point.y)) ?? { x: at.x, y: at.y };
}

/** Wing frame and position. Reduced motion holds the home flower and closed wings. */
export function butterflyPose(
  flight: ButterflyFlight,
  elapsedMs: number,
  reducedMotion: boolean,
): { x: number; y: number; frame: number } {
  if (reducedMotion || flight.legs.length === 0) return { x: flight.home.x, y: flight.home.y, frame: 0 };
  const t = ((elapsedMs % flight.periodMs) + flight.periodMs) % flight.periodMs;
  const leg = legAt(flight.legs, t);
  const into = t - leg.startMs;
  if (into < leg.pauseMs) {
    return { x: leg.from.x, y: leg.from.y, frame: Math.floor(elapsedMs / BUTTERFLY_REST_FRAME_MS) % 4 };
  }
  const u = Math.min(1, (into - leg.pauseMs) / leg.flyMs);
  const ease = u * u * (3 - 2 * u);
  const dx = leg.to.x - leg.from.x;
  const dy = leg.to.y - leg.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const sway = Math.sin(u * Math.PI * 2 * leg.waves) * leg.wobble * Math.sin(u * Math.PI);
  return {
    x: leg.from.x + dx * ease + (-dy / len) * sway,
    y: leg.from.y + dy * ease + (dx / len) * sway,
    frame: Math.floor(elapsedMs / BUTTERFLY_FRAME_MS) % 4,
  };
}

/** Moves a drawn butterfly toward its target at most `maxSpeed` px/s, so a scare never teleports it. */
export function glideToward(current: FlightPoint, target: FlightPoint, deltaMs: number, maxSpeed: number): FlightPoint {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  const step = (maxSpeed * Math.max(0, deltaMs)) / 1000;
  if (dist <= step || dist === 0) return { x: target.x, y: target.y };
  return { x: current.x + (dx / dist) * step, y: current.y + (dy / dist) * step };
}

function legAt(legs: readonly FlightLeg[], t: number): FlightLeg {
  let lo = 0;
  let hi = legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (legs[mid]!.startMs <= t) lo = mid;
    else hi = mid - 1;
  }
  return legs[lo]!;
}

function hash(x: number, y: number): number {
  let h = 2166136261;
  for (const n of [Math.round(x), Math.round(y)]) {
    h ^= n;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
