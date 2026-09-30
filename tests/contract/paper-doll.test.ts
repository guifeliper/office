import { describe, expect, it } from 'vitest';
import { INK, paintMatrix } from '../../scripts/body-art';
import { checkFrame } from '../../scripts/frame-check';
import {
  HAIR_RAMPS,
  HAT_RAMPS,
  OUTFIT_RAMPS,
  SKIN_RAMPS,
  STILL,
  alphaMask,
  contrastOk,
  hueShiftOk,
  shapeMatrix,
  stillFrame,
} from '../../src/renderer/office/cast';
import {
  COMBINATION_COUNT,
  HATS,
  OUTFITS,
  SKINS,
  appearanceFromSeed,
  appearanceKey,
} from '../../src/renderer/office/paper-doll';

const BASE = { skin: 0, hair: 0, hairShape: 0, outfit: 0, hat: 0, accessory: 0 };

function inkCount(img: { width: number; height: number; data: Uint8Array }): number {
  let n = 0;
  for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
    const o = (y * img.width + x) * 4;
    if (img.data[o + 3] === 0) continue;
    const c = (img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!;
    if (c === INK) n += 1;
  }
  return n;
}

describe('paper-doll catalog', () => {
  it('keeps 4800 looks and does not pile 1000 seeds onto one key', () => {
    expect(SKINS).toHaveLength(5);
    expect(HAIR_RAMPS).toHaveLength(5);
    expect(OUTFITS).toHaveLength(4);
    expect(HATS).toHaveLength(4);
    expect(COMBINATION_COUNT).toBe(5 * 5 * 3 * 4 * 4 * 4);
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i += 1) {
      const key = appearanceKey(appearanceFromSeed(`consultant-${i}`));
      expect(appearanceKey(appearanceFromSeed(`consultant-${i}`))).toBe(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(10);
  });

  it('uses the conversation id, so sprint-14 is not sprint-15', () => {
    expect(appearanceKey(appearanceFromSeed('sprint-14'))).toBe(appearanceKey(appearanceFromSeed('sprint-14')));
    expect(appearanceKey(appearanceFromSeed('sprint-14'))).not.toBe(appearanceKey(appearanceFromSeed('sprint-15')));
  });

  it('keeps the hue shift on every ramp and the outfit contrast', () => {
    for (const ramp of [...SKIN_RAMPS, ...HAIR_RAMPS]) expect(hueShiftOk(ramp)).toBe(true);
    for (const outfit of OUTFIT_RAMPS) {
      expect(hueShiftOk(outfit.shirt)).toBe(true);
      expect(hueShiftOk(outfit.pants)).toBe(true);
      for (const color of [...outfit.shirt, ...outfit.pants]) expect(contrastOk(color)).toBe(true);
    }
  });

  it('recolors without moving a pixel, and the eyes stay ink', () => {
    const pale = stillFrame('south', BASE);
    const deep = stillFrame('south', { ...BASE, skin: 4, hair: 2, outfit: 3 });
    expect(alphaMask(pale)).toBe(alphaMask(deep));
    expect(inkCount(pale)).toBe(inkCount(deep));
    expect(inkCount(pale)).toBeGreaterThan(0);
  });

  it('keeps the hair step and the 4×3 shine on all three shapes', () => {
    for (const shape of [0, 1, 2]) {
      const painted = paintMatrix(shapeMatrix(STILL.south, shape, 'south'));
      const result = checkFrame(`forma ${shape}`, painted, 'split');
      expect(result.detail).toBe('ok');
    }
    const bare = stillFrame('south', BASE);
    const bun = stillFrame('south', { ...BASE, hairShape: 1 });
    expect(bun.height).toBe(68);
    let added = 0;
    for (let i = 3; i < bare.data.length; i += 4) if (bare.data[i] === 0 && bun.data[i] !== 0) added += 1;
    expect(added).toBe(4);
  });

  it('gives every hat a crown of at least 4 px and does not invent ink', () => {
    const bare = stillFrame('north', BASE);
    for (const hat of [1, 2, 3]) {
      const worn = stillFrame('north', { ...BASE, hat });
      let crown = 0;
      for (let i = 3; i < bare.data.length; i += 4) if (bare.data[i] === 0 && worn.data[i] !== 0) crown += 1;
      expect(crown).toBeGreaterThanOrEqual(4);
      expect(inkCount(worn)).toBe(inkCount(bare));
    }
    const brim = stillFrame('north', { ...BASE, hat: 3 });
    const bareBox = opaqueWidth(bare);
    expect(opaqueWidth(brim)).toBeGreaterThan(bareBox);
    expect(HAT_RAMPS[0]).toBeNull();
  });
});

function opaqueWidth(img: { width: number; height: number; data: Uint8Array }): number {
  let minX = img.width;
  let maxX = -1;
  for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
    if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  return maxX - minX + 1;
}
