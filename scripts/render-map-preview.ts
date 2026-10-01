/**
 * Offline render of the office at 1× (plus 2× crops) for the pass/fail review in
 * `docs/design/art-direction-map-pass.md`. Same layout, ground, and depth keys as the app.
 *
 *   npx vite-node scripts/render-map-preview.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { canopyDepth, depthFromFeet, foregroundDepth } from '../src/renderer/office/depth';
import { paintCell } from '../src/renderer/office/ground-tiles';
import {
  COLS,
  DESK_PLACEMENTS,
  MONITOR_HEIGHT,
  MONITOR_LIFT,
  PROPS,
  PROP_SPECS,
  ROWS,
  TILE,
  bushVariant,
  canopyLineY,
  canopyVariant,
  chairSpriteAnchor,
  propBase,
  seatAnchor,
  type PropKind,
} from '../src/renderer/office/world-layout';
import { LEISURE_DEFS } from '../src/renderer/office/leisure';
import { waypointFor } from '../src/renderer/office/landmarks';
import { paintSit } from '../src/renderer/office/station-art';
import { leisureFrames, stillFrame } from '../src/renderer/office/cast';
import { blit, createImage, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'src/renderer/office/art');
const OUT = path.join(ROOT, 'docs/design/r7');
const CANOPY_FILES = ['tree-canopy.png'] as const;

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

const W = COLS * TILE;
const H = ROWS * TILE;
const scene = createImage(W, H);
for (let i = 0; i < W * H; i += 1) scene.data.set([0xff, 0xf8, 0xf1, 255], i * 4);
for (let r = 0; r < ROWS; r += 1) {
  for (let c = 0; c < COLS; c += 1) {
    const px = paintCell(c, r);
    if (!px) continue;
    for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) setPixel(scene, c * TILE + x, r * TILE + y, px[y * TILE + x]!);
  }
}

const cache = new Map<string, Rgba>();
const load = (file: string) => {
  if (!cache.has(file)) {
    const rel = file.startsWith('/') ? file.slice(1) : file.includes('/') ? file : `props/${file}`;
    cache.set(file, readPng(path.join(ART, rel)));
  }
  return cache.get(file)!;
};

interface Draw {
  z: number;
  img: Rgba;
  /** Bottom-center anchor. */
  x: number;
  y: number;
  anchorY?: number;
}
const draws: Draw[] = [];
for (const p of PROPS) {
  const f = FILES[p.kind];
  const { x, y } = propBase(p);
  const baseName = p.kind === 'bush' ? (bushVariant(p.col, p.row) === 0 ? 'bush.png' : 'bush-b.png') : f.base;
  const base = load(baseName);
  if (p.kind === 'chair') {
    const seat = chairSpriteAnchor(p);
    draws.push({ z: depthFromFeet(seat.y) - 0.25, img: base, x: Math.round(seat.x), y: seat.y });
  } else if (p.kind === 'lodgeRoof') {
    draws.push({ z: foregroundDepth(y), img: base, x: Math.round(x), y });
  } else {
    draws.push({ z: depthFromFeet(y), img: base, x: Math.round(x), y });
  }
  const sort = PROP_SPECS[p.kind].foreground;
  if (f.foreground && sort !== 'none') {
    const top = load(sort === 'canopy' ? CANOPY_FILES[canopyVariant(p.col, p.row) % CANOPY_FILES.length]! : f.foreground);
    if (sort === 'canopy') {
      const line = canopyLineY(p);
      draws.push({ z: canopyDepth(line), img: top, x: Math.round(x), y: line + 1 });
    } else {
      draws.push({ z: foregroundDepth(y), img: top, x: Math.round(x), y: y - base.height });
    }
  }
}

// Standing consultants for the depth check: one tile south of a canopy line, one tile north.
const pilot = stillFrame('south');
const probe = PROPS.find((p) => p.kind === 'tree' && p.col === 30 && p.row === 12)!;
const line = canopyLineY(probe);
const px = Math.round(propBase(probe).x);
const probes = [
  { x: px + 22, feet: line + TILE },
  { x: px - 22, feet: line - TILE },
  { x: 40 * TILE, feet: 36 * TILE + 8 },
];
for (const p of probes) draws.push({ z: depthFromFeet(p.feet), img: pilot, x: p.x, y: p.feet, anchorY: 56 });

const leisure = leisureFrames();
const leisureFrame = {
  campfire: leisure.campfire[0]!,
  woodpile: leisure.woodpile[2]!,
  garden: leisure.garden[1]!,
};
for (const def of LEISURE_DEFS) {
  if (def !== LEISURE_DEFS.find((d) => d.kind === def.kind)) continue;
  const spot = waypointFor(def);
  draws.push({
    z: depthFromFeet(spot.y),
    img: leisureFrame[def.kind],
    x: spot.x,
    y: spot.y,
    anchorY: 56,
  });
}

const monitorSheet = load('/props/monitor.png');
function monitorFrame(index: number): Rgba {
  const frame = createImage(16, MONITOR_HEIGHT);
  for (let y = 0; y < MONITOR_HEIGHT; y += 1) {
    const start = (y * monitorSheet.width + index * 16) * 4;
    frame.data.set(monitorSheet.data.subarray(start, start + 16 * 4), y * 16 * 4);
  }
  return frame;
}
const offScreen = monitorFrame(0);
const workingScreen = monitorFrame(2);
DESK_PLACEMENTS.forEach((placed, index) => {
  const base = propBase(placed);
  draws.push({
    z: depthFromFeet(base.y) + 0.1,
    img: index === 0 ? workingScreen : offScreen,
    x: Math.round(base.x),
    y: base.y - MONITOR_LIFT,
  });
  if (index === 0) {
    const seat = seatAnchor(placed);
    draws.push({ z: depthFromFeet(seat.y), img: paintSit()[0]!, x: seat.x, y: seat.y, anchorY: 56 });
  }
});

draws.sort((a, b) => a.z - b.z);
for (const d of draws) {
  const top = d.anchorY !== undefined ? d.y - d.anchorY : d.y - d.img.height;
  blit(scene, d.img, d.x - Math.floor(d.img.width / 2), top);
}

function crop(src: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = createImage(w, h);
  for (let yy = 0; yy < h; yy += 1) {
    const from = ((y + yy) * src.width + x) * 4;
    out.data.set(src.data.subarray(from, from + w * 4), yy * w * 4);
  }
  return out;
}

const treeCrop = { x: px - 96, y: line - 96, w: 192, h: 144 };
const groundCrop = { x: 520, y: 250, w: 220, h: 140 };
const lodgeCrop = { x: 760, y: 80, w: 240, h: 200 };

function panel(src: Rgba, frame: { x: number; y: number; w: number; h: number }): Rgba {
  return scaleImage(crop(src, frame.x, frame.y, frame.w, frame.h), 2);
}

function sideBySide(images: Rgba[]): Rgba {
  const gap = 8;
  const h = Math.max(...images.map((img) => img.height));
  const w = images.reduce((sum, img) => sum + img.width, 0) + gap * (images.length - 1);
  const out = createImage(w, h);
  for (let i = 0; i < w * h; i += 1) out.data.set([0xff, 0xf8, 0xf1, 255], i * 4);
  let x = 0;
  for (const img of images) {
    blit(out, img, x, Math.floor((h - img.height) / 2));
    x += img.width + gap;
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
writePng(path.join(OUT, 'scene-1x.png'), scene);
writePng(path.join(OUT, 'crop-tree-2x.png'), panel(scene, treeCrop));
writePng(path.join(OUT, 'crop-ground-2x.png'), panel(scene, groundCrop));
writePng(path.join(OUT, 'crop-lodge-2x.png'), panel(scene, lodgeCrop));
writePng(path.join(OUT, 'crop-pond-2x.png'), scaleImage(crop(scene, 480, 16, 320, 160), 2));

const r6Path = path.join(ROOT, 'docs/design/r6/scene-1x.png');
if (fs.existsSync(r6Path)) {
  const r6 = readPng(r6Path);
  writePng(path.join(OUT, 'compare-r6-r7.png'), sideBySide([r6, scene]));
}
fs.mkdirSync(path.join(ROOT, 'docs/design/map-pass'), { recursive: true });
writePng(path.join(ROOT, 'docs/design/map-pass/scene-1x.png'), scene);
console.log('wrote', OUT);
