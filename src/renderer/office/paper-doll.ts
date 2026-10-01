/**
 * Paper-doll catalog. The body is the approved matrix in `cast.ts`.
 * A recolor swaps the 3-tone ramp of a material and does not move a pixel.
 */
import {
  BASE_LOOK,
  HAIR_RAMPS,
  HAT_RAMPS,
  OUTFIT_RAMPS,
  SKIN_RAMPS,
  leisureFrames,
  sitFrames,
  stillFrame,
  walkFrames,
} from './cast';

export type Facing = 'south' | 'north' | 'east' | 'west';

export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Appearance {
  skin: number;
  hair: number;
  hairShape: number;
  outfit: number;
  hat: number;
  accessory: number;
}

export const SKINS = SKIN_RAMPS;
export const HAIR_COLORS = HAIR_RAMPS;
export const OUTFITS: readonly { shirt: readonly number[]; pants: readonly number[]; wide: boolean }[] =
  OUTFIT_RAMPS.map((outfit) => ({ shirt: outfit.shirt, pants: outfit.pants, wide: false }));
export const HATS = HAT_RAMPS;

/** 0 none, 1 glasses, 2 scarf, 3 pin. */
export const ACCESSORY_COUNT = 4;
export const HAIR_SHAPE_COUNT = 3;

export function appearanceFromSeed(stableId: string): Appearance {
  return {
    skin: mix(stableId, 'skin') % SKINS.length,
    hair: mix(stableId, 'hair') % HAIR_COLORS.length,
    hairShape: mix(stableId, 'shape') % HAIR_SHAPE_COUNT,
    outfit: mix(stableId, 'outfit') % OUTFITS.length,
    hat: mix(stableId, 'hat') % HATS.length,
    accessory: mix(stableId, 'accessory') % ACCESSORY_COUNT,
  };
}

export function appearanceKey(appearance: Appearance): string {
  return [
    appearance.skin,
    appearance.hair,
    appearance.hairShape,
    appearance.outfit,
    appearance.hat,
    appearance.accessory,
  ].join('.');
}

export const COMBINATION_COUNT = SKINS.length * HAIR_COLORS.length * HAIR_SHAPE_COUNT * OUTFITS.length * HATS.length * ACCESSORY_COUNT;

function mix(id: string, salt: string): number {
  let h = 2166136261;
  const text = `${salt}:${id}`;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colorAt(img: Rgba, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return -1;
  const o = (y * img.width + x) * 4;
  if (img.data[o + 3]! === 0) return -1;
  return (img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!;
}

export function cloneSprite(src: Rgba): Rgba {
  return { width: src.width, height: src.height, data: new Uint8Array(src.data) };
}

export function opaqueCount(img: Rgba): number {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 0) n += 1;
  return n;
}

export function opaqueBox(img: Rgba): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (colorAt(img, x, y) < 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/** Paints the still from the matrix. The source image is ignored: the pilot is not a mask anymore. */
export function recolorSprite(src: Rgba, facing: Facing, appearance: Appearance, palette?: readonly number[]): Rgba {
  void src;
  void palette;
  return stillFrame(facing, appearance);
}

export function deriveSit(appearance: Appearance = BASE_LOOK): Rgba[] {
  return sitFrames(appearance);
}

export function deriveLeisure(appearance: Appearance = BASE_LOOK): {
  campfire: Rgba[];
  woodpile: Rgba[];
  garden: Rgba[];
} {
  return leisureFrames(appearance);
}

export function walkSheet(facing: Facing, appearance: Appearance = BASE_LOOK): Rgba[] {
  return walkFrames(facing, appearance);
}
