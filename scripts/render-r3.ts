/**
 * Round-3 proof sheets.
 *   npx vite-node scripts/render-r3.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { canopyDepth, depthFromFeet, foregroundDepth } from '../src/renderer/office/depth';
import { paintCell } from '../src/renderer/office/ground-tiles';
import { appearanceFromSeed } from '../src/renderer/office/paper-doll';
import { leisureFrames, sitFrames, stillFrame, walkFrames } from '../src/renderer/office/cast';
import {
  COLS,
  DESK_PLACEMENTS,
  LODGE,
  MONITOR_HEIGHT,
  MONITOR_LIFT,
  PROPS,
  PROP_SPECS,
  ROWS,
  TILE,
  canopyLineY,
  chairSpriteAnchor,
  propBase,
  seatAnchor,
  type PropKind,
} from '../src/renderer/office/world-layout';
import { checkAllFrames, checkCatalog, checkRecolor } from './frame-check';
import { blit, createImage, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'src/renderer/office/art');
const OUT = path.join(ROOT, 'docs/design/r3');
fs.mkdirSync(OUT, { recursive: true });

const FACINGS = ['south', 'north', 'east', 'west'] as const;
const checks = [...checkCatalog(), ...checkAllFrames(), ...checkRecolor()];
const failed = checks.filter((item) => !item.pass);
fs.writeFileSync(path.join(OUT, 'checker.json'), JSON.stringify({
  ok: checks.length - failed.length,
  total: checks.length,
  failed,
}, null, 2));
console.error(`checker ${checks.length - failed.length}/${checks.length}`);

const walk = createImage(6 * 48, FACINGS.length * 68);
FACINGS.forEach((facing, row) => {
  walkFrames(facing).forEach((frame, col) => blit(walk, frame, col * 48, row * 68));
});
writePng(path.join(OUT, 'walk-sheet-2x.png'), scaleImage(walk, 2));

const cast = createImage(6 * 48, 2 * 68);
for (let i = 0; i < 12; i += 1) {
  const frame = stillFrame('south', appearanceFromSeed(`consultant-${i}`));
  blit(cast, frame, (i % 6) * 48, Math.floor(i / 6) * 68);
}
writePng(path.join(OUT, 'cast-12-2x.png'), scaleImage(cast, 2));

const leisure = leisureFrames();
const leisureSheet = createImage(4 * 48, 3 * 68);
[leisure.campfire, leisure.woodpile, leisure.garden].forEach((frames, row) => {
  frames.forEach((frame, col) => blit(leisureSheet, frame, col * 48, row * 68));
});
writePng(path.join(OUT, 'leisure-2x.png'), scaleImage(leisureSheet, 2));

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

const scene = createImage(COLS * TILE, ROWS * TILE);
for (let i = 0; i < scene.data.length; i += 4) scene.data.set([0xff, 0xf8, 0xf1, 255], i);
for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
  const px = paintCell(c, r);
  if (!px) continue;
  for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
    setPixel(scene, c * TILE + x, r * TILE + y, px[y * TILE + x]!);
  }
}

const cache = new Map<string, Rgba>();
const load = (file: string) => {
  if (!cache.has(file)) cache.set(file, readPng(path.join(ART, 'props', file)));
  return cache.get(file)!;
};

interface Draw { z: number; img: Rgba; x: number; y: number; anchorY?: number }
const draws: Draw[] = [];
for (const p of PROPS) {
  if (p.kind === 'lodgeRoof') continue;
  const f = FILES[p.kind];
  const { x, y } = propBase(p);
  const base = load(f.base);
  if (p.kind === 'chair') {
    const seat = chairSpriteAnchor(p);
    draws.push({ z: depthFromFeet(seat.y) - 0.25, img: base, x: Math.round(seat.x), y: seat.y });
  } else {
    draws.push({ z: depthFromFeet(y), img: base, x: Math.round(x), y });
  }
  const sort = PROP_SPECS[p.kind].foreground;
  if (f.foreground && sort !== 'none') {
    const top = load(f.foreground);
    if (sort === 'canopy') {
      const line = canopyLineY(p);
      draws.push({ z: canopyDepth(line), img: top, x: Math.round(x), y: line + 1 });
    } else {
      draws.push({ z: foregroundDepth(y), img: top, x: Math.round(x), y: y - base.height });
    }
  }
}

const monitorSheet = load('monitor.png');
function monitorFrame(index: number): Rgba {
  const frame = createImage(16, MONITOR_HEIGHT);
  for (let y = 0; y < MONITOR_HEIGHT; y += 1) {
    const start = (y * monitorSheet.width + index * 16) * 4;
    frame.data.set(monitorSheet.data.subarray(start, start + 16 * 4), y * 16 * 4);
  }
  return frame;
}
DESK_PLACEMENTS.forEach((placed, index) => {
  const base = propBase(placed);
  const seat = seatAnchor(placed);
  draws.push({
    z: depthFromFeet(base.y) + 0.1,
    img: monitorFrame(index % 4),
    x: Math.round(base.x),
    y: base.y - MONITOR_LIFT,
  });
  draws.push({
    z: depthFromFeet(seat.y),
    img: sitFrames(appearanceFromSeed(`consultant-${index}`))[0]!,
    x: seat.x,
    y: seat.y,
    anchorY: 56,
  });
});

draws.sort((a, b) => a.z - b.z);
for (const d of draws) {
  const top = d.anchorY !== undefined ? d.y - d.anchorY : d.y - d.img.height;
  blit(scene, d.img, Math.round(d.x - d.img.width / 2), Math.round(top));
}

const cropX = (LODGE.left - 1) * TILE;
const cropY = (LODGE.top - 1) * TILE;
const cropW = (LODGE.right - LODGE.left + 3) * TILE;
const cropH = (LODGE.bottom - LODGE.top + 3) * TILE;
const lodge = createImage(cropW, cropH);
for (let y = 0; y < cropH; y += 1) {
  const from = ((cropY + y) * scene.width + cropX) * 4;
  lodge.data.set(scene.data.subarray(from, from + cropW * 4), y * cropW * 4);
}
writePng(path.join(OUT, 'lodge-1x.png'), lodge);
writePng(path.join(OUT, 'lodge-2x.png'), scaleImage(lodge, 2));
console.error('wrote', OUT);
