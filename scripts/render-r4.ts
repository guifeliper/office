/**
 * Round-4 proof sheets. Character only — the grass tile is read, not edited.
 *   npx vite-node scripts/render-r4.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { paintCell } from '../src/renderer/office/ground-tiles';
import { COLS, ROWS, terrainAt } from '../src/renderer/office/world-layout';
import { STILL, leisureFrames, walkFrames, walkMatrix } from '../src/renderer/office/cast';
import { paintMatrix } from './body-art';
import { rubric } from './body-rubric';
import { armSwing, checkAllFrames, checkCatalog, checkCombinations, checkRecolor, shoeGap, shoeRise } from './frame-check';
import { blit, createImage, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs/design/r4');
const PREV = path.join(ROOT, 'docs/design/r3');
fs.mkdirSync(OUT, { recursive: true });

const FACINGS = ['south', 'north', 'east', 'west'] as const;

const checks = [...checkCatalog(), ...checkAllFrames(), ...checkRecolor()];
const failed = checks.filter((item) => !item.pass);
const combos = checkCombinations();
const measures = FACINGS.flatMap((facing) => {
  const still = paintMatrix(STILL[facing]);
  return [0, 1, 2, 3, 4, 5].map((frame) => {
    const painted = paintMatrix(walkMatrix(facing, frame));
    return { facing, frame, foot: shoeRise(painted), gap: shoeGap(painted), arm: armSwing(still, painted) };
  });
});
fs.writeFileSync(path.join(OUT, 'checker.json'), `${JSON.stringify({
  ok: checks.length - failed.length,
  total: checks.length,
  failed,
  looks: combos.looks,
  lookFailures: combos.failed,
  measures,
}, null, 2)}\n`);
console.error(`checker ${checks.length - failed.length}/${checks.length} looks ${combos.looks} fail ${combos.failed.length}`);

const walk = createImage(6 * 48, FACINGS.length * 68);
FACINGS.forEach((facing, row) => {
  walkFrames(facing).forEach((frame, col) => blit(walk, frame, col * 48, row * 68));
});
const walk2 = scaleImage(walk, 2);
writePng(path.join(OUT, 'walk-sheet-2x.png'), walk2);

function grassTile(): Int32Array {
  for (let row = 1; row < ROWS - 1; row += 1) for (let col = 1; col < COLS - 1; col += 1) {
    if (terrainAt(col, row) !== 'grass') continue;
    const cell = paintCell(col, row);
    if (cell) return cell;
  }
  throw new Error('no grass tile');
}

/** 1×, the integer fit for a view smaller than twice the world. South then east, on grass. */
const tile = grassTile();
const map = createImage(6 * 40, 2 * 80);
for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
  setPixel(map, x, y, tile[(y % 16) * 16 + (x % 16)]!);
}
(['south', 'east'] as const).forEach((facing, row) => {
  walkFrames(facing).forEach((frame, col) => blit(map, frame, col * 40 - 8, row * 80 + 6));
});
writePng(path.join(OUT, 'walk-in-map-1x.png'), map);

const leisure = leisureFrames();
const leisureSheet = createImage(4 * 48, 3 * 68);
[leisure.campfire, leisure.woodpile, leisure.garden].forEach((frames, row) => {
  frames.forEach((frame, col) => blit(leisureSheet, frame, col * 48, row * 68));
});
const leisure2 = scaleImage(leisureSheet, 2);
writePng(path.join(OUT, 'leisure-2x.png'), leisure2);

const r3Walk = readPng(path.join(PREV, 'walk-sheet-2x.png'));
const r3Leisure = readPng(path.join(PREV, 'leisure-2x.png'));
const gap = 8;
const compare = createImage(
  Math.max(r3Walk.width, walk2.width, r3Leisure.width, leisure2.width),
  r3Walk.height + walk2.height + r3Leisure.height + leisure2.height + gap * 3,
);
for (let i = 0; i < compare.data.length; i += 4) compare.data.set([0x20, 0x1b, 0x0f, 255], i);
blit(compare, r3Walk, 0, 0);
blit(compare, walk2, 0, r3Walk.height + gap);
blit(compare, r3Leisure, 0, r3Walk.height + walk2.height + gap * 2);
blit(compare, leisure2, 0, r3Walk.height + walk2.height + r3Leisure.height + gap * 3);
writePng(path.join(OUT, 'compare-r3-r4.png'), compare);

const pilot = (facing: string) => readPng(path.join(ROOT, 'docs/design/pilot', `consultant-${facing}.png`));
const shadow = { grass: [0x3e6a38, 0x2a4a26], path: [0xd9c4a4, 0xd9c4a4] } as const;
function composite(sprite: Rgba, colors: readonly [number, number]): Rgba {
  const out = createImage(48, 68);
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) setPixel(out, x, y, tile[(y % 16) * 16 + (x % 16)]!);
  for (let x = 18; x <= 29; x += 1) {
    setPixel(out, x, 56, colors[0]);
    setPixel(out, x, 57, colors[1]);
  }
  blit(out, sprite, 0, 0);
  return out;
}
for (const facing of FACINGS) {
  const body = paintMatrix(STILL[facing]);
  const result = rubric(body, facing, {
    pilot: pilot(facing),
    composites: {
      grass: composite(body.image, shadow.grass),
      path: composite(body.image, shadow.path),
      shadowTop: [shadow.grass[0], shadow.path[0]],
      shadowBottom: [shadow.grass[1], shadow.path[1]],
    },
    refColors: new Set<number>(),
    readsAt1x: null,
  });
  const bad = Object.entries(result).filter(([key, item]) => !item.pass && !key.startsWith('9'));
  console.error(`still ${facing} ${bad.length ? bad.map(([k]) => k).join(', ') : '1–8 e 10 ok'}`);
  if (facing === 'south') console.error(`  ${result['5 dobras']?.value}`);
  if (facing === 'south') console.error(`  ${result['7 sel-out']?.value}`);
}
