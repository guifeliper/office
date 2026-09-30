/**
 * Dozing in the cabin armchair, renderer memory only.
 * Folder 19 is 192×32: six frames, not four facings.
 * Frames 0–1 are the small upper pose. Frames 4–5 mirror 2–3.
 * The doze loops the side-lying pair, frames 2 and 3. Nothing is mirrored.
 */

export type SleepPhase = 'go' | 'doze';

export interface SleepState {
  phase: SleepPhase;
  phaseMs: number;
}

/** Quiet time before a doze. Still inside the 15-minute departure. */
export const SLEEP_AFTER_MS = 8 * 60_000;
export const SLEEP_STEP_MS = 700;
const SLEEP_STILL = 2;

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

export function sleepPose(state: SleepState, play: boolean): { action: 'sleep'; frame: number; whileMoving: boolean } | null {
  if (state.phase !== 'doze') return null;
  const frame = play ? SLEEP_STILL + (Math.floor(state.phaseMs / SLEEP_STEP_MS) % 2) : SLEEP_STILL;
  return { action: 'sleep', frame, whileMoving: false };
}
