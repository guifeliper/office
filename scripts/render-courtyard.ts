/**
 * Proof render of the Tiny Farm courtyard.
 *
 *   npx vite-node scripts/render-courtyard.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { canopyDepth, depthFromFeet, foregroundDepth } from '../src/renderer/office/depth';
import { paintCell } from '../src/renderer/office/ground-tiles';
import {
  COLS,
  PROPS,
  PROP_SPECS,
  ROWS,
  TILE,
  bushVariant,
  canopyLineY,
  canopyVariant,
  propBase,
  type PropKind,
} from '../src/renderer/office/world-layout';
import { blit, createImage, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';
import { CACHE } from './pack-paths';

const ROOT = path.resolve(import.meta.dirname, '..');
const YARD = path.join(CACHE, 'yard');
const OUT = path.join(ROOT, 'docs/design/tiny-farm');

const FILES: Record<PropKind, { base: string; foreground?: string }> = {
  meetingTable: { base: 'meeting-table.png' },
  campfire: { base: 'bonfire-0.png' },
  stumpAxe: { base: 'stump.png' },
  woodpile: { base: 'woodpile.png' },
  gardenBed: { base: 'garden-bed.png' },
  gateLeft: { base: 'gate-post.png' },
  gateRight: { base: 'gate-post.png' },
  gatehouse: { base: 'gatehouse-base.png', foreground: 'gatehouse-lintel.png' },
  lodgeDoor: { base: 'lodge-door.png' },
  fence: { base: 'fence.png' },
  tree: { base: 'maple-trunk.png', foreground: 'maple-canopy-0.png' },
  rock: { base: 'rock.png' },
  bush: { base: 'bush-a.png' },
  shoreRock: { base: 'shore-rock.png' },
  lodgeRoof: { base: 'lodge-house.png' },
  bridge: { base: 'bridge.png' },
  mailbox: { base: 'mailbox.png' },
  lantern: { base: 'lantern.png' },
  flower: { base: 'flower.png' },
  bloom: { base: 'bloom.png' },
  mushroom: { base: 'mushroom.png' },
  banana: { base: 'banana.png' },
  cherry: { base: 'cherry.png' },
  fruitTree: { base: 'fruit-tree.png' },
  lily: { base: 'lily.png' },
  doghouse: { base: 'doghouse.png' },
  laundry: { base: 'laundry.png' },
  hay: { base: 'hay.png' },
  crate: { base: 'crate.png' },
  butterfly: { base: 'butterfly.png' },
  greenhouse: { base: 'greenhouse.png' },
  canoe: { base: 'canoe.png' },
  pier: { base: 'pier.png' },
  sandcastle: { base: 'sandcastle.png' },
  waterfall: { base: 'waterfall.png' },
  fishman: { base: 'fishman.png' },
};

const width = COLS * TILE;
const height = ROWS * TILE;
const scene = createImage(width, height);
for (let i = 0; i < width * height; i += 1) scene.data.set([0xff, 0xf8, 0xf1, 255], i * 4);
for (let r = 0; r < ROWS; r += 1) {
  for (let c = 0; c < COLS; c += 1) {
    const px = paintCell(c, r);
    if (!px) continue;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) setPixel(scene, c * TILE + x, r * TILE + y, px[y * TILE + x]!);
    }
  }
}

const cache = new Map<string, Rgba>();
const load = (file: string) => {
  const full = file.startsWith('/') ? file : path.join(YARD, file);
  if (!cache.has(full)) cache.set(full, readPng(full));
  return cache.get(full)!;
};

interface Draw { z: number; img: Rgba; x: number; y: number }
const draws: Draw[] = [];
for (const placement of PROPS) {
  const files = FILES[placement.kind];
  const { x, y } = propBase(placement);
  const baseName = placement.kind === 'bush'
    ? (bushVariant(placement.col, placement.row) === 0 ? 'bush-a.png' : 'bush-b.png')
    : files.base;
  const base = load(baseName);
  draws.push({ z: depthFromFeet(y), img: base, x: Math.round(x), y });
  const sort = PROP_SPECS[placement.kind].foreground;
  const topName = placement.kind === 'tree'
    ? `maple-canopy-${canopyVariant(placement.col, placement.row) % 3}.png`
    : files.foreground;
  if (topName && sort !== 'none') {
    const top = load(topName);
    if (sort === 'canopy') {
      const line = canopyLineY(placement);
      draws.push({ z: canopyDepth(line), img: top, x: Math.round(x), y: line + 1 });
    } else {
      draws.push({ z: foregroundDepth(y), img: top, x: Math.round(x), y: y - base.height });
    }
  }
}

draws.sort((a, b) => a.z - b.z);
for (const draw of draws) {
  blit(scene, draw.img, draw.x - Math.floor(draw.img.width / 2), draw.y - draw.img.height);
}

function crop(src: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = createImage(w, h);
  for (let yy = 0; yy < h; yy += 1) {
    const from = ((y + yy) * src.width + x) * 4;
    out.data.set(src.data.subarray(from, from + w * 4), yy * w * 4);
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'island-rounds'), { recursive: true });
writePng(path.join(OUT, 'courtyard-1x.png'), scene);
writePng(path.join(OUT, 'island-hub-1x.png'), scene);
writePng(path.join(OUT, 'island-rounds/r16-1x.png'), scene);
writePng(path.join(OUT, 'courtyard-2x.png'), scaleImage(crop(scene, 8 * TILE, 8 * TILE, 32 * TILE, 32 * TILE), 2));
console.warn('wrote', OUT);
