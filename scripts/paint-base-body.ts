/**
 * Round-2 base body proof. Not wired into the app.
 *
 *   READS_1X=1 npx vite-node scripts/paint-base-body.ts [reference.jpg|png]
 *
 * READS_1X records the eye check of rubric item 9 after looking at the 1× composites.
 * The reference is only sampled into the comparison render; it is never written as an asset.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { grassTileAt, inTrunkShade, paintCell } from '../src/renderer/office/ground-tiles';
import { COLS, ROWS, terrainAt } from '../src/renderer/office/world-layout';
import { EAST, NORTH, SOUTH, WEST, paintMatrix, type BodyMatrix, type Material, type Painted } from './body-art';
import { rubric, type Facing } from './body-rubric';
import { blit, createImage, getPixel, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs/design/base-body');
fs.mkdirSync(OUT, { recursive: true });

const FACINGS: Record<Facing, BodyMatrix> = { south: SOUTH, north: NORTH, east: EAST, west: WEST };
const painted = Object.fromEntries(Object.entries(FACINGS).map(([f, m]) => [f, paintMatrix(m)])) as Record<Facing, Painted>;
const south = painted.south;

const MATERIALS: Material[] = ['skin', 'hair', 'shirt', 'pants', 'shoe'];
const TINT: Record<Material, number> = { skin: 0xff8080, hair: 0x8060ff, shirt: 0x40c0ff, pants: 0xffd040, shoe: 0x60ff80 };
const maskSheet = createImage(48 * MATERIALS.length, 68 * 4);
(Object.keys(FACINGS) as Facing[]).forEach((facing, row) => {
  const body = painted[facing];
  writePng(path.join(OUT, `base-${facing}.png`), body.image);
  MATERIALS.forEach((name, index) => {
    const mask = createImage(48, 68);
    for (const [key, m] of body.material) if (m === name) {
      setPixel(mask, key % 48, Math.floor(key / 48), 0xffffff);
      setPixel(maskSheet, index * 48 + (key % 48), row * 68 + Math.floor(key / 48), TINT[name]);
    }
    writePng(path.join(OUT, facing === 'south' ? `mask-${name}.png` : `mask-${facing}-${name}.png`), mask);
  });
});
writePng(path.join(OUT, 'masks-2x.png'), scaleImage(maskSheet, 2));

function findTile(match: (col: number, row: number) => boolean): Int32Array {
  for (let row = 1; row < ROWS - 1; row += 1) for (let col = 1; col < COLS - 1; col += 1) {
    if (match(col, row)) return paintCell(col, row)!;
  }
  throw new Error('tile not found');
}
const grassTile = findTile((c, r) => terrainAt(c, r) === 'grass' && grassTileAt(c, r) === 'grass-0' && !inTrunkShade(c, r));
const pathTile = findTile((c, r) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dc, dr]) => terrainAt(c + dc!, r + dr!) === 'path'));

/** Contact shadow drawn under the body, outside its PNG: 12×2 on rows 56–57. */
export const SHADOW = { grass: [0x3e6a38, 0x2a4a26], path: [0xd9c4a4, 0xd9c4a4] } as const;

function composite(sprite: Rgba, tile: Int32Array, shadow: readonly [number, number] | null): Rgba {
  const out = createImage(48, 68);
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) setPixel(out, x, y, tile[(y % 16) * 16 + (x % 16)]!);
  if (shadow) for (let x = 18; x <= 29; x += 1) { setPixel(out, x, 56, shadow[0]); setPixel(out, x, 57, shadow[1]); }
  blit(out, sprite, 0, 0);
  return out;
}

// Reference: 3.4 screen px per art px, sampled at pixel centers around the standing figure.
const refArg = process.argv[2] ?? '/Users/guilhermereis/.cursor/projects/Users-guilhermereis-www-Private-Office/assets/image-0928cf31-fc5d-466a-91f5-00a3be93b0a6.png';
const refPng = path.join(os.tmpdir(), 'cursor-office-ref.png');
execFileSync('sips', ['-s', 'format', 'png', refArg, '--out', refPng], { stdio: 'ignore' });
const ref = readPng(refPng);
fs.rmSync(refPng, { force: true });
const ch = ref.data.length / (ref.width * ref.height);
const refAt = (x: number, y: number) => {
  const o = (Math.round(y) * ref.width + Math.round(x)) * ch;
  return (ref.data[o]! << 16) | (ref.data[o + 1]! << 8) | ref.data[o + 2]!;
};
const PERIOD = 3.4;
function phase(axis: 'x' | 'y'): number {
  let c = 0, s = 0;
  for (let y = 100; y < 700; y += 2) for (let x = 20; x < 1000; x += 2) {
    const a = refAt(x, y);
    const b = axis === 'x' ? refAt(x + 1, y) : refAt(x, y + 1);
    const d = Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) + Math.abs((a & 255) - (b & 255));
    if (d <= 90) continue;
    const e = (axis === 'x' ? x : y) + 0.5;
    c += Math.cos((2 * Math.PI * e) / PERIOD);
    s += Math.sin((2 * Math.PI * e) / PERIOD);
  }
  return ((Math.atan2(s, c) / (2 * Math.PI)) * PERIOD + PERIOD) % PERIOD;
}
const px0 = phase('x');
const py0 = phase('y');
function refCrop(feetX: number, feetY: number): Rgba {
  const out = createImage(48, 68);
  const ax0 = Math.round((feetX - px0) / PERIOD) - 24;
  const ay0 = Math.round((feetY - py0) / PERIOD) - 56;
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) {
    setPixel(out, x, y, refAt(px0 + (ax0 + x + 0.5) * PERIOD, py0 + (ay0 + y + 0.5) * PERIOD));
  }
  return out;
}
const refStanding = refCrop(Number(process.env.REF_X ?? 432), Number(process.env.REF_Y ?? 484));
const refColors = new Set<number>();
for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) refColors.add(getPixel(refStanding, x, y));

const r2South = readPng(path.join(OUT, 'r2-snap-south.png'));
const grassR2b = composite(south.image, grassTile, SHADOW.grass);
const pathR2b = composite(south.image, pathTile, SHADOW.path);

const gap = 4;
const sheet = createImage(3 * 48 + 4 * gap, 2 * 68 + 3 * gap);
for (let i = 0; i < sheet.width * sheet.height; i += 1) sheet.data.set([0x20, 0x1b, 0x0f, 255], i * 4);
([[grassTile, SHADOW.grass, grassR2b], [pathTile, SHADOW.path, pathR2b]] as const).forEach(([tile, shadow, r2b], row) => {
  const top = gap + row * (68 + gap);
  blit(sheet, composite(r2South, tile, shadow), gap, top);
  blit(sheet, r2b, gap * 2 + 48, top);
  blit(sheet, refStanding, gap * 3 + 96, top);
});
writePng(path.join(OUT, 'r2b-compare-south-1x.png'), sheet);
writePng(path.join(OUT, 'r2b-compare-south-2x.png'), scaleImage(sheet, 2));

const dirSheet = createImage(4 * 48 + 5 * gap, 2 * 68 + 3 * gap);
for (let i = 0; i < dirSheet.width * dirSheet.height; i += 1) dirSheet.data.set([0x20, 0x1b, 0x0f, 255], i * 4);
(['south', 'north', 'east', 'west'] as Facing[]).forEach((facing, col) => {
  blit(dirSheet, composite(painted[facing].image, grassTile, SHADOW.grass), gap + col * (48 + gap), gap);
  blit(dirSheet, composite(painted[facing].image, pathTile, SHADOW.path), gap + col * (48 + gap), gap * 2 + 68);
});
writePng(path.join(OUT, 'r2b-directions-1x.png'), dirSheet);
writePng(path.join(OUT, 'r2b-directions-2x.png'), scaleImage(dirSheet, 2));

// READS_1X=south,north,east,west lists the facings whose 1× composites were checked by eye.
const readList = new Set((process.env.READS_1X ?? '').split(',').map((s) => (s === '1' ? 'south' : s)).filter(Boolean));
const only = process.env.FACING as Facing | undefined;
for (const facing of Object.keys(FACINGS) as Facing[]) {
  if (only && facing !== only) continue;
  const body = painted[facing];
  const grass = composite(body.image, grassTile, SHADOW.grass);
  const pathC = composite(body.image, pathTile, SHADOW.path);
  const result = rubric(body, facing, {
    pilot: readPng(path.join(ROOT, `src/renderer/office/art/${facing}.png`)),
    composites: { grass, path: pathC, shadowTop: [SHADOW.grass[0], SHADOW.path[0]], shadowBottom: [SHADOW.grass[1], SHADOW.path[1]] },
    refColors,
    readsAt1x: process.env.READS_1X === undefined ? null : readList.has(facing),
  });
  const ordered = Object.fromEntries(Object.entries(result).sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10)));
  fs.writeFileSync(path.join(OUT, `r2b-rubric-${facing}.json`), `${JSON.stringify(ordered, null, 2)}\n`);
  console.warn(`== ${facing}`);
  for (const [k, v] of Object.entries(ordered)) console.warn(`${v.pass ? 'PASS' : 'FAIL'} ${k}: ${v.value}`);
}
