/**
 * Garden leisure, renderer memory only.
 * Till with the hoe, crouch to plant, water, then the bed grows until harvest.
 */

export type GardenPhase = 'till' | 'plant' | 'water' | 'grow' | 'harvest';
export type CropStage = 0 | 1 | 2 | 3;
export type GardenAction = 'hoe' | 'sit' | 'water' | 'idle';

export interface GardenState {
  phase: GardenPhase;
  stage: CropStage;
  phaseMs: number;
}

export interface GardenBed {
  col: number;
  row: number;
}

export const TILL_MS = 6 * 160;
export const PLANT_MS = 640;
export const WATER_MS = 8 * 140;
export const STAGE_MS = 4000;
export const HARVEST_MS = 640;

export function initialGarden(): GardenState {
  return { phase: 'till', stage: 0, phaseMs: 0 };
}

export function gardenAction(phase: GardenPhase): GardenAction {
  if (phase === 'till' || phase === 'harvest') return 'hoe';
  if (phase === 'plant') return 'sit';
  if (phase === 'water') return 'water';
  return 'idle';
}

/** Advance one bed. Absent consultants leave a growing or ripe crop alone. */
export function stepGarden(state: GardenState, deltaMs: number, present: boolean, reducedMotion: boolean): GardenState {
  if (reducedMotion) return { phase: 'grow', stage: 3, phaseMs: 0 };
  if (!present) {
    if (state.phase !== 'grow' || state.stage >= 3) return state;
    return grow(state, deltaMs);
  }
  const phaseMs = state.phaseMs + Math.max(0, deltaMs);
  if (state.phase === 'till' && phaseMs >= TILL_MS) return { phase: 'plant', stage: 0, phaseMs: 0 };
  if (state.phase === 'plant' && phaseMs >= PLANT_MS) return { phase: 'water', stage: 0, phaseMs: 0 };
  if (state.phase === 'water' && phaseMs >= WATER_MS) return { phase: 'grow', stage: 1, phaseMs: 0 };
  if (state.phase === 'grow') {
    const grown = grow(state, deltaMs);
    if (grown.stage === 3 && grown.phaseMs >= STAGE_MS) return { phase: 'harvest', stage: 3, phaseMs: 0 };
    return grown;
  }
  if (state.phase === 'harvest' && phaseMs >= HARVEST_MS) return initialGarden();
  return { ...state, phaseMs };
}

function grow(state: GardenState, deltaMs: number): GardenState {
  let stage = state.stage;
  let phaseMs = state.phaseMs + Math.max(0, deltaMs);
  while (stage < 3 && phaseMs >= STAGE_MS) {
    phaseMs -= STAGE_MS;
    stage = (stage + 1) as CropStage;
  }
  return { phase: 'grow', stage, phaseMs };
}

/** One bed per consultant, in id order. Extra consultants wait. */
export function claimBeds(ids: readonly string[], beds: readonly GardenBed[]): Map<string, GardenBed> {
  const out = new Map<string, GardenBed>();
  const sorted = [...ids].sort();
  sorted.forEach((id, index) => {
    const bed = beds[index];
    if (bed) out.set(id, bed);
  });
  return out;
}
