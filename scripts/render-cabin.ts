/**
 * Static proof of the cabin from the runtime layout and the Tiny Farm crops.
 *   npx vite-node scripts/render-cabin.ts
 * Writes docs/design/interior/cabin-1x.png (and a 2× crop for review).
 */
import path from 'node:path';
import { blit, createImage, readPng, scaleImage, writePng, type Rgba } from './png';
import { CACHE } from './pack-paths';
import {
  CABIN_COLS,
  CABIN_PROPS,
  CABIN_ROWS,
  CAST_CELL,
  CAST_FEET_ROW,
  WALL_ROWS,
  cabinSpriteAnchor,
  flameAnchor,
} from '../src/renderer/office/cabin-layout';
import { DESKS, HEARTH_SPOTS, COFFEE_SPOTS } from '../src/renderer/office/landmarks';
import { castFrameRect, type CastAction } from '../src/renderer/office/tiny-farm-cast';
import type { Facing } from '../src/renderer/office/landmarks';

const ROOT = path.resolve(import.meta.dirname, '..');
const ART = CACHE;
const OUT = path.join(ROOT, 'docs/design/interior');
const TILE = 16;

const load = (rel: string) => readPng(path.join(ART, rel));
const FILE: Record<string, string> = {
  desk: 'cabin/desk.png', computer: 'cabin/computer.png', chair: 'cabin/chair-north.png',
  fireplace: 'cabin/fireplace.png', bookshelf: 'cabin/bookshelf.png', plant: 'cabin/plant.png',
  counter: 'cabin/counter.png', kettle: 'cabin/kettle.png', mug: 'cabin/mug.png',
  armchair: 'cabin/armchair.png', cat: 'cabin/cat.png', door: 'cabin/door.png',
};

function cropCell(img: Rgba, r: { x: number; y: number; w: number; h: number }): Rgba {
  const out = createImage(r.w, r.h);
  for (let y = 0; y < r.h; y += 1) {
    const from = ((r.y + y) * img.width + r.x) * 4;
    out.data.set(img.data.subarray(from, from + r.w * 4), y * r.w * 4);
  }
  return out;
}

const W = CABIN_COLS * TILE;
const H = CABIN_ROWS * TILE;
const scene = createImage(W, H);

const floor = load('cabin/floor.png');
for (let r = WALL_ROWS; r < CABIN_ROWS; r += 1) for (let c = 0; c < CABIN_COLS; c += 1) blit(scene, floor, c * TILE, r * TILE);
const walls = [load('cabin/wall-window.png'), load('cabin/wall-plain.png')];
for (let i = 0; i * 64 < W; i += 1) blit(scene, walls[i % 2 === 0 ? 1 : 0]!, i * 64, 0);

interface Draw { z: number; img: Rgba; x: number; y: number }
const draws: Draw[] = [];
const place = (img: Rgba, ax: number, ay: number, z: number, anchorY = 1) => {
  draws.push({ z, img, x: Math.round(ax - img.width / 2), y: Math.round(ay - img.height * anchorY) });
};

for (const p of CABIN_PROPS) {
  const a = cabinSpriteAnchor(p);
  place(load(FILE[p.kind]!), a.x, a.y, a.z);
  if (p.kind === 'fireplace') {
    const f = flameAnchor(p);
    place(load('cabin/flame-1.png'), f.x, f.y, f.z);
  }
}

const looks = Array.from({ length: 16 }, (_, i) => load(`cast/look-${String(i).padStart(2, '0')}.png`));
const body = (look: number, action: CastAction, facing: Facing, frame: number, x: number, y: number) => {
  const img = cropCell(looks[look]!, castFrameRect(action, facing, frame));
  draws.push({ z: y, img, x: Math.round(x - CAST_CELL / 2), y: Math.round(y - CAST_FEET_ROW) });
};

DESKS.forEach((desk, i) => body(i % 16, 'sit', 'north', 0, desk.x, desk.y));
body(8, 'sit', 'north', 0, HEARTH_SPOTS[1]!.x, HEARTH_SPOTS[1]!.y);
body(11, 'sit', 'north', 0, HEARTH_SPOTS[2]!.x, HEARTH_SPOTS[2]!.y);
body(12, 'idle', 'north', 0, COFFEE_SPOTS[0]!.x, COFFEE_SPOTS[0]!.y);
body(13, 'walk', 'north', 2, 11 * TILE + 8, 15 * TILE + 8);

draws.sort((a, b) => a.z - b.z);
for (const d of draws) blit(scene, d.img, d.x, d.y);

writePng(path.join(OUT, 'cabin-1x.png'), scene);
writePng(path.join(OUT, 'cabin-16-1x.png'), scene);
writePng(path.join(OUT, 'cabin-2x.png'), scaleImage(scene, 2));
console.warn('wrote', path.join(OUT, 'cabin-1x.png'), `${W}×${H}`);
