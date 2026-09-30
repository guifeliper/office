import type { Facing } from './landmarks';
import type { LeisureKind } from './leisure';
import { CAST_CELL } from './cabin-layout';

/**
 * Tiny Farm cast strips, composed by `scripts/cut-cabin.ts` from the pack layers
 * (skin, eyes, farm clothes, hair, tool). One PNG per look, one row per action,
 * 32×32 cells, pack order south / north / east / west. No mirrored or redrawn frames.
 */
export const LOOK_COUNT = 16;

export const LOOK_URLS: readonly string[] = Array.from({ length: LOOK_COUNT }, (_, i) =>
  new URL(`../../../.cache/tiny-farm/cast/look-${String(i).padStart(2, '0')}.png`, import.meta.url).href,
);

export type CastAction =
  | 'idle' | 'walk' | 'sit' | 'axe' | 'hoe' | 'water'
  | 'fishCast' | 'fishWait' | 'fishBite' | 'fishReel' | 'fishCatch';

export const CAST_ROW: Record<CastAction, number> = {
  idle: 0, walk: 1, sit: 2, axe: 3, hoe: 4, water: 5,
  fishCast: 6, fishWait: 7, fishBite: 8, fishReel: 9, fishCatch: 10,
};
export const CAST_FRAMES: Record<CastAction, number> = {
  idle: 4, walk: 6, sit: 1, axe: 6, hoe: 6, water: 8,
  fishCast: 15, fishWait: 4, fishBite: 8, fishReel: 4, fishCatch: 4,
};

const FACING_ORDER: readonly Facing[] = ['south', 'north', 'east', 'west'];

export function castFrameRect(action: CastAction, facing: Facing, frame: number): { x: number; y: number; w: number; h: number } {
  const count = CAST_FRAMES[action];
  const index = FACING_ORDER.indexOf(facing) * count + (((frame % count) + count) % count);
  return { x: index * CAST_CELL, y: CAST_ROW[action] * CAST_CELL, w: CAST_CELL, h: CAST_CELL };
}

/** One pack row per activity. Fishing cycles through its own rows, so it is not here. */
export const LEISURE_ACTION: Record<Exclude<LeisureKind, 'fishing'>, CastAction> = {
  hearth: 'sit',
  coffee: 'idle',
  woodpile: 'axe',
  garden: 'hoe',
};

/** Same seed, same look. Consultants seed from the conversation; collaborators from their own id. */
export function lookIndexFor(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % LOOK_COUNT;
}
