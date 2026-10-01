/**
 * Fishing leisure, renderer memory only.
 * Cast, wait, a bite, reel, and the catch, then it starts again.
 * Every frame comes from the Tiny Farm fishing rows.
 */

export type FishPhase = 'cast' | 'wait' | 'bite' | 'reel' | 'catch';

export interface FishState {
  phase: FishPhase;
  phaseMs: number;
}

const ORDER: readonly FishPhase[] = ['cast', 'wait', 'bite', 'reel', 'catch'];

export const FISH_FRAMES: Record<FishPhase, number> = {
  cast: 15,
  wait: 4,
  bite: 8,
  reel: 4,
  catch: 4,
};

export const FISH_STEP_MS: Record<FishPhase, number> = {
  cast: 80,
  wait: 280,
  bite: 80,
  reel: 100,
  catch: 140,
};

/** How many times the wait loop plays before the bite. */
const WAIT_LOOPS = 3;

export const FISH_PHASE_MS: Record<FishPhase, number> = {
  cast: FISH_FRAMES.cast * FISH_STEP_MS.cast,
  wait: FISH_FRAMES.wait * FISH_STEP_MS.wait * WAIT_LOOPS,
  bite: FISH_FRAMES.bite * FISH_STEP_MS.bite,
  reel: FISH_FRAMES.reel * FISH_STEP_MS.reel,
  catch: FISH_FRAMES.catch * FISH_STEP_MS.catch,
};

export function initialFish(): FishState {
  return { phase: 'cast', phaseMs: 0 };
}

export function fishFrame(phase: FishPhase, phaseMs: number): number {
  const count = FISH_FRAMES[phase];
  const step = FISH_STEP_MS[phase];
  return Math.floor(Math.max(0, phaseMs) / step) % count;
}

export function stepFish(state: FishState, deltaMs: number, present: boolean, reducedMotion: boolean): FishState {
  if (reducedMotion || !present) return { phase: 'wait', phaseMs: 0 };
  const phaseMs = state.phaseMs + Math.max(0, deltaMs);
  if (phaseMs < FISH_PHASE_MS[state.phase]) return { phase: state.phase, phaseMs };
  const next = ORDER[(ORDER.indexOf(state.phase) + 1) % ORDER.length]!;
  return { phase: next, phaseMs: 0 };
}
