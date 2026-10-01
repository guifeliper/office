/**
 * Dozing in the cabin armchair, renderer memory only.
 * Folder 19 Sleep is only head and hands, drawn to lie under a bed blanket, and the cabin has no bed.
 * The doze is the pack sit-south pose on the armchair with the "=_=" speech bubble over the head.
 */

export type SleepPhase = 'go' | 'doze';

export interface SleepState {
  phase: SleepPhase;
  phaseMs: number;
}

/** Quiet time before a doze. Still inside the 15-minute departure. */
export const SLEEP_AFTER_MS = 8 * 60_000;
/** The bubble rises one pixel and settles, like a slow breath. */
export const SLEEP_STEP_MS = 900;

export function initialSleep(): SleepState {
  return { phase: 'go', phaseMs: 0 };
}

export function maySleep(quietMs: number | null, absenceMs: number): boolean {
  return quietMs !== null && quietMs >= SLEEP_AFTER_MS && quietMs < absenceMs;
}

export function stepSleep(state: SleepState, deltaMs: number, arrived: boolean, reducedMotion: boolean): SleepState {
  if (reducedMotion) return { phase: state.phase, phaseMs: 0 };
  const phaseMs = state.phaseMs + Math.max(0, deltaMs);
  if (state.phase === 'go') return arrived ? { phase: 'doze', phaseMs: 0 } : { phase: 'go', phaseMs };
  return { phase: 'doze', phaseMs };
}

/** Frame is the bubble lift, 0 or 1. Reduced motion holds 0. */
export function sleepPose(state: SleepState, play: boolean): { action: 'sleep'; frame: number; whileMoving: boolean } | null {
  if (state.phase !== 'doze') return null;
  const frame = play ? Math.floor(state.phaseMs / SLEEP_STEP_MS) % 2 : 0;
  return { action: 'sleep', frame, whileMoving: false };
}
