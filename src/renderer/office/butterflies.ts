/** Courtyard monarchs. Routes are pure data; the scene moves the sprites. */

export interface FlightPoint {
  x: number;
  y: number;
}

export interface ButterflyFlight {
  points: readonly FlightPoint[];
  pauseMs: number;
  legMs: number;
}

export const BUTTERFLY_PAUSE_MS = 700;
export const BUTTERFLY_LEG_MS = 2800;
export const BUTTERFLY_FRAME_MS = 140;
const MAX_FLIGHTS = 4;
const MIN_PERCH = 64;

export function butterflyFlights(
  perches: readonly FlightPoint[],
  blocked: (x: number, y: number) => boolean,
): ButterflyFlight[] {
  const open = perches
    .filter((point) => !blocked(point.x, point.y))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const chosen: FlightPoint[] = [];
  for (const point of open) {
    if (chosen.some((other) => Math.hypot(other.x - point.x, other.y - point.y) < MIN_PERCH)) continue;
    chosen.push(point);
  }
  const flights: ButterflyFlight[] = [];
  for (let i = 0; i + 2 < chosen.length && flights.length < MAX_FLIGHTS; i += 3) {
    const points = chosen.slice(i, i + 3);
    if (points.some((point, index) => index > 0 && segmentBlocked(points[index - 1]!, point, blocked))) continue;
    flights.push({ points, pauseMs: BUTTERFLY_PAUSE_MS, legMs: BUTTERFLY_LEG_MS });
  }
  return flights;
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

/** Wing frame and position. Reduced motion holds the first perch and the closed wings. */
export function butterflyPose(
  flight: ButterflyFlight,
  elapsedMs: number,
  reducedMotion: boolean,
): { x: number; y: number; frame: number } {
  const first = flight.points[0]!;
  if (reducedMotion || flight.points.length < 2) return { x: first.x, y: first.y, frame: 0 };
  const leg = flight.pauseMs + flight.legMs;
  const span = leg * flight.points.length;
  const t = ((elapsedMs % span) + span) % span;
  const index = Math.floor(t / leg) % flight.points.length;
  const from = flight.points[index]!;
  const to = flight.points[(index + 1) % flight.points.length]!;
  const into = t - index * leg;
  if (into < flight.pauseMs) {
    return { x: from.x, y: from.y, frame: Math.floor(elapsedMs / BUTTERFLY_FRAME_MS) % 4 };
  }
  const u = (into - flight.pauseMs) / flight.legMs;
  return {
    x: from.x + (to.x - from.x) * u,
    y: from.y + (to.y - from.y) * u,
    frame: Math.floor(elapsedMs / BUTTERFLY_FRAME_MS) % 4,
  };
}
