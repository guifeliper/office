/**
 * Catching insects, renderer memory only.
 * An occasional courtyard idle chases one butterfly, swings the net, and walks home.
 * The butterfly is scared off. Nothing deletes it.
 */

export type BugPhase = 'chase' | 'swing' | 'flee' | 'back';

export interface BugState {
  phase: BugPhase;
  phaseMs: number;
}

export const BUG_REACH = 22;
export const BUG_SWING_MS = 6 * 110;
export const BUG_FLEE_MS = 900;
export const BUG_GIVE_UP_MS = 6_000;
export const BUG_PERIOD_MS = 45_000;
export const BUG_WINDOW_MS = 1_500;
const NET_STEP = 110;
const NET_FRAMES = 6;

export function initialBug(): BugState {
  return { phase: 'chase', phaseMs: 0 };
}

export function idHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return hash;
}

/** True for a short window each period. The window is a pure function of the id. */
export function chaseDue(id: string, now: number): boolean {
  const slot = idHash(`${id}:bug`) % BUG_PERIOD_MS;
  const t = ((now % BUG_PERIOD_MS) + BUG_PERIOD_MS) % BUG_PERIOD_MS;
  const delta = Math.abs(t - slot);
  return Math.min(delta, BUG_PERIOD_MS - delta) <= BUG_WINDOW_MS;
}

export function stepBug(state: BugState, deltaMs: number, near: boolean, reducedMotion: boolean): BugState {
  if (reducedMotion) return { phase: state.phase, phaseMs: 0 };
  const phaseMs = state.phaseMs + Math.max(0, deltaMs);
  if (state.phase === 'chase') {
    if (near) return { phase: 'swing', phaseMs: 0 };
    if (phaseMs >= BUG_GIVE_UP_MS) return { phase: 'back', phaseMs: 0 };
    return { phase: 'chase', phaseMs };
  }
  if (state.phase === 'swing') return phaseMs >= BUG_SWING_MS ? { phase: 'flee', phaseMs: 0 } : { phase: 'swing', phaseMs };
  if (state.phase === 'flee') return phaseMs >= BUG_FLEE_MS ? { phase: 'back', phaseMs: 0 } : { phase: 'flee', phaseMs };
  return { phase: 'back', phaseMs };
}

export function bugPose(state: BugState, play: boolean): { action: 'net'; frame: number; whileMoving: boolean } | null {
  if (state.phase !== 'swing') return null;
  return { action: 'net', frame: play ? Math.floor(state.phaseMs / NET_STEP) % NET_FRAMES : 0, whileMoving: false };
}
