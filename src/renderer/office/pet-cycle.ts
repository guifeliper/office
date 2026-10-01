/**
 * Petting the cabin cat, renderer memory only.
 * Walk to the cat, play folder 20, walk home, rest. One consultant at a time.
 */

export type PetPhase = 'go' | 'pet' | 'back' | 'rest';

export interface PetState {
  phase: PetPhase;
  phaseMs: number;
}

export const PET_MS = 3 * 180 * 3;
export const PET_REST_MS = 4_000;
const PET_STEP = 180;
const PET_FRAMES = 3;

export function initialPet(): PetState {
  return { phase: 'go', phaseMs: 0 };
}

export function stepPet(state: PetState, deltaMs: number, arrived: boolean, reducedMotion: boolean): PetState {
  if (reducedMotion) return { phase: state.phase, phaseMs: 0 };
  const phaseMs = state.phaseMs + Math.max(0, deltaMs);
  if (state.phase === 'go') return arrived ? { phase: 'pet', phaseMs: 0 } : { phase: 'go', phaseMs };
  if (state.phase === 'pet') return phaseMs >= PET_MS ? { phase: 'back', phaseMs: 0 } : { phase: 'pet', phaseMs };
  if (state.phase === 'back') return arrived ? { phase: 'rest', phaseMs: 0 } : { phase: 'back', phaseMs };
  return phaseMs >= PET_REST_MS ? { phase: 'go', phaseMs: 0 } : { phase: 'rest', phaseMs };
}

export function petPose(state: PetState, play: boolean): { action: 'pet'; frame: number; whileMoving: boolean } | null {
  if (state.phase !== 'pet') return null;
  return { action: 'pet', frame: play ? Math.floor(state.phaseMs / PET_STEP) % PET_FRAMES : 0, whileMoving: false };
}
