/**
 * Proof render for the Tiny Farm ground and pine slice.
 *
 *   npx vite-node scripts/render-tiny-farm.ts
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
  chairSpriteAnchor,
  propBase,
  type PropKind,
} from '../src/renderer/office/world-layout';
import { blit, createImage, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';
import { CACHE } from './pack-paths';

const ROOT = path.resolve(import.meta.dirname, '..');
const ART = path.join(ROOT, 'src/renderer/office/art/props');
const PACK_PROPS = path.join(CACHE, 'props');
const OUT = path.join(ROOT, 'docs/design/tiny-farm');

const FILES: Record<PropKind, { base: string; foreground?: string }> = {
  desk: { base: 'desk.png' },
  meetingTable: { base: 'meeting-table.png' },
  campfire: { base: 'campfire.png' },
  stumpAxe: { base: 'stump-axe.png' },
  woodpile: { base: 'woodpile.png' },
  pingpong: { base: 'pingpong.png' },
  gardenBed: { base: 'garden-bed.png' },
  gateLeft: { base: 'gate-left.png' },
  gateRight: { base: 'gate-right.png' },
  gatehouse: { base: 'gatehouse-base.png', foreground: 'gatehouse-lintel.png' },
  lodgeDoor: { base: 'lodge-door.png' },
  fence: { base: 'fence.png' },
  tree: { base: 'tree-trunk.png', foreground: 'tree-canopy.png' },
  rock: { base: 'rock.png' },
  bush: { base: 'bush.png' },
  flowerTuft: { base: 'flower-tuft.png' },
  shoreRock: { base: 'shore-rock.png' },
  chair: { base: 'chair.png' },
  lodgeRoof: { base: 'lodge-roof.png' },
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
  if (!cache.has(file)) {
    const fromPack = path.join(PACK_PROPS, file);
    const chosen = fs.existsSync(fromPack) ? fromPack : path.join(ART, file);
    cache.set(file, readPng(chosen));
  }
  return cache.get(file)!;
};

interface Draw { z: number; img: Rgba; x: number; y: number }
const draws: Draw[] = [];
for (const placement of PROPS) {
  const files = FILES[placement.kind];
  const { x, y } = propBase(placement);
  const baseName = placement.kind === 'bush'
    ? (bushVariant(placement.col, placement.row) === 0 ? 'bush.png' : 'bush-b.png')
    : files.base;
  const base = load(baseName);
  if (placement.kind === 'chair') {
    const seat = chairSpriteAnchor(placement);
    draws.push({ z: depthFromFeet(seat.y) - 0.25, img: base, x: Math.round(seat.x), y: seat.y });
  } else if (placement.kind === 'lodgeRoof') {
    draws.push({ z: foregroundDepth(y), img: base, x: Math.round(x), y });
  } else {
    draws.push({ z: depthFromFeet(y), img: base, x: Math.round(x), y });
  }
  const sort = PROP_SPECS[placement.kind].foreground;
  if (files.foreground && sort !== 'none') {
    const top = load(files.foreground);
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

const pine = PROPS.find((p) => p.kind === 'tree' && p.col === 30 && p.row === 12)!;
const pineBase = propBase(pine);
fs.mkdirSync(OUT, { recursive: true });
writePng(path.join(OUT, 'ground-tree-1x.png'), scene);
writePng(path.join(OUT, 'path-2x.png'), scaleImage(crop(scene, 34 * TILE, 20 * TILE, 16 * TILE, 12 * TILE), 2));
writePng(
  path.join(OUT, 'pine-2x.png'),
  scaleImage(crop(scene, Math.round(pineBase.x) - 48, pineBase.y - 64, 96, 80), 2),
);
console.warn('wrote', OUT);
