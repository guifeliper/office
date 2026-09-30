import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPng, type Rgba } from '../../scripts/png';
import { packRoot } from '../../scripts/pack-paths';

interface Crop {
  name: string;
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Crops whose opaque pixels must not run off the rect into more of the same sprite. */
const CLOSED: readonly Crop[] = [
  { name: 'bush-a', file: 'Objects/Tree/Deep Forest/bushes.png', x: 9, y: 0, w: 32, h: 31 },
  { name: 'bush-b', file: 'Objects/Tree/Deep Forest/bushes.png', x: 57, y: 0, w: 32, h: 31 },
  { name: 'fence', file: 'Objects/Exterior/Fence and Bridge/Fence Wood.png', x: 48, y: 0, w: 48, h: 14 },
  { name: 'pier', file: 'Objects/Exterior/Fence and Bridge/Bridge Beach.png', x: 0, y: 96, w: 48, h: 14 },
  { name: 'palm', file: 'Objects/Exterior/Beach/Coconut Tree.png', x: 3, y: 9, w: 72, h: 35 },
  { name: 'lily-0', file: 'Objects/Props/Spring/props water.png', x: 0, y: 1, w: 15, h: 14 },
  { name: 'lily-1', file: 'Objects/Props/Spring/props water.png', x: 0, y: 18, w: 15, h: 14 },
  { name: 'reed-0', file: 'Objects/Props/Spring/props water.png', x: 19, y: 66, w: 13, h: 11 },
  { name: 'crop-0', file: 'Crops/Spring/Strawberry.png', x: 0, y: 0, w: 16, h: 16 },
  { name: 'crop-3', file: 'Crops/Spring/Strawberry.png', x: 80, y: 0, w: 16, h: 16 },
];

function opaque(img: Rgba, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false;
  return (img.data[(y * img.width + x) * 4 + 3] ?? 0) >= 128;
}

function continues(img: Rgba, crop: Crop): boolean {
  for (let y = crop.y; y < crop.y + crop.h; y += 1) {
    for (let x = crop.x; x < crop.x + crop.w; x += 1) {
      const edge = x === crop.x || y === crop.y || x === crop.x + crop.w - 1 || y === crop.y + crop.h - 1;
      if (!edge || !opaque(img, x, y)) continue;
      if (x === crop.x && opaque(img, x - 1, y)) return true;
      if (x === crop.x + crop.w - 1 && opaque(img, x + 1, y)) return true;
      if (y === crop.y && opaque(img, x, y - 1)) return true;
      if (y === crop.y + crop.h - 1 && opaque(img, x, y + 1)) return true;
    }
  }
  return false;
}

describe('courtyard crops', () => {
  it('does not clip a sprite where the pack sheet continues', () => {
    let pack = '';
    try {
      pack = packRoot();
    } catch {
      return;
    }
    const cache = path.resolve('..', '.cache/tiny-farm/yard');
    for (const crop of CLOSED) {
      const sheet = readPng(path.join(pack, crop.file));
      expect(continues(sheet, crop), crop.name).toBe(false);
      const runtime = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../.cache/tiny-farm/yard', `${crop.name}.png`);
      if (fs.existsSync(runtime)) {
        const img = readPng(runtime);
        expect(img.width).toBeGreaterThan(0);
        expect(img.height).toBeGreaterThan(0);
      }
      void cache;
    }
  });
});
