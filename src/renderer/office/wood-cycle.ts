/**
 * Woodcutter, renderer memory only.
 * Chop at the stump, lift the log, carry it, set it down, walk home, rest, repeat.
 * Lift and set-down are the pick-up row; set-down plays that row backward.
 * Folder 13.4 is a throw, so it is not used.
 */

export type WoodPhase = 'approach' | 'chop' | 'lift' | 'haul' | 'drop' | 'return' | 'rest';

export interface WoodState {
  phase: WoodPhase;
  phaseMs: number;
}

export const WOOD_CHOP_MS = 6 * 120 * 2;
export const WOOD_LIFT_MS = 4 * 140;
export const WOOD_DROP_MS = 4 * 140;
export const WOOD_REST_MS = 1_600;

const AXE_STEP = 120;
const HAND_STEP = 140;
const HAUL_STEP = 110;

export function initialWood(): WoodState {
  return { phase: 'approach', phaseMs: 0 };
}

export function woodTravels(phase: WoodPhase): boolean {
  return phase === 'approach' || phase === 'haul' || phase === 'return';
}

export function stepWood(state: WoodState, deltaMs: number, arrived: boolean, reducedMotion: boolean): WoodState {
  if (reducedMotion) return { phase: state.phase, phaseMs: 0 };
  const phaseMs = state.phaseMs + Math.max(0, deltaMs);
  if (state.phase === 'approach') return arrived ? { phase: 'chop', phaseMs: 0 } : { phase: 'approach', phaseMs };
  if (state.phase === 'chop') return phaseMs >= WOOD_CHOP_MS ? { phase: 'lift', phaseMs: 0 } : { phase: 'chop', phaseMs };
  if (state.phase === 'lift') return phaseMs >= WOOD_LIFT_MS ? { phase: 'haul', phaseMs: 0 } : { phase: 'lift', phaseMs };
  if (state.phase === 'haul') return arrived ? { phase: 'drop', phaseMs: 0 } : { phase: 'haul', phaseMs };
  if (state.phase === 'drop') return phaseMs >= WOOD_DROP_MS ? { phase: 'return', phaseMs: 0 } : { phase: 'drop', phaseMs };
  if (state.phase === 'return') return arrived ? { phase: 'rest', phaseMs: 0 } : { phase: 'return', phaseMs };
  return phaseMs >= WOOD_REST_MS ? { phase: 'approach', phaseMs: 0 } : { phase: 'rest', phaseMs };
}

/** Null while walking home or up to the stump: those use the plain walk row. */
export function woodPose(state: WoodState, play: boolean): { action: 'axe' | 'carryPick' | 'carryWalk'; frame: number; whileMoving: boolean } | null {
  if (state.phase === 'chop') {
    return { action: 'axe', frame: play ? Math.floor(state.phaseMs / AXE_STEP) % 6 : 0, whileMoving: false };
  }
  if (state.phase === 'lift') {
    return { action: 'carryPick', frame: play ? Math.min(3, Math.floor(state.phaseMs / HAND_STEP)) : 0, whileMoving: false };
  }
  if (state.phase === 'haul') {
    return { action: 'carryWalk', frame: play ? Math.floor(state.phaseMs / HAUL_STEP) % 6 : 0, whileMoving: true };
  }
  if (state.phase === 'drop') {
    const step = play ? Math.min(3, Math.floor(state.phaseMs / HAND_STEP)) : 0;
    return { action: 'carryPick', frame: 3 - step, whileMoving: false };
  }
  return null;
}
