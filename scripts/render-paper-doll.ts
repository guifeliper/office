/**
 * Proof renders for the paper-doll pass.
 *   npx vite-node scripts/render-paper-doll.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { DESK_PLACEMENTS, seatAnchor } from '../src/renderer/office/world-layout';
import { appearanceFromSeed } from '../src/renderer/office/paper-doll';
import { stillFrame } from '../src/renderer/office/cast';
import { paintSit } from '../src/renderer/office/station-art';
import { blit, createImage, readPng, scaleImage, writePng } from './png';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs/design/paper-doll');
fs.mkdirSync(OUT, { recursive: true });

for (const seed of ['seed-ada', 'seed-nils', 'seed-keiko']) {
  const frame = stillFrame('south', appearanceFromSeed(seed));
  writePng(path.join(OUT, `${seed}.png`), scaleImage(frame, 4));
}

const seeds = Array.from({ length: 12 }, (_, i) => `doll-${i}`);
const cellW = 48;
const cellH = 68;
const gap = 8;
const grid = createImage(4 * cellW + 5 * gap, 3 * cellH + 4 * gap);
for (let i = 0; i < seeds.length; i += 1) {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const frame = stillFrame('south', appearanceFromSeed(seeds[i]!));
  blit(grid, frame, gap + col * (cellW + gap), gap + row * (cellH + gap));
}
writePng(path.join(OUT, 'grid-south-2x.png'), scaleImage(grid, 2));

const scenePath = path.join(ROOT, 'docs/design/map-pass/scene-1x.png');
const scene = readPng(scenePath);
const seats = DESK_PLACEMENTS.map((desk) => seatAnchor(desk));
seats.forEach((seat, index) => {
  const sit = paintSit(appearanceFromSeed(seeds[index % seeds.length]!))[0]!;
  blit(scene, sit, Math.round(seat.x - sit.width / 2), Math.round(seat.y - 56));
});
const cropX = Math.min(...seats.map((s) => s.x)) - 40;
const cropY = Math.min(...seats.map((s) => s.y)) - 64;
const cropW = Math.max(...seats.map((s) => s.x)) + 40 - cropX;
const cropH = Math.max(...seats.map((s) => s.y)) + 16 - cropY;
const crop = createImage(cropW, cropH);
for (let y = 0; y < cropH; y += 1) {
  const from = ((cropY + y) * scene.width + cropX) * 4;
  crop.data.set(scene.data.subarray(from, from + cropW * 4), y * cropW * 4);
}
writePng(path.join(OUT, 'crop-lodge-1x.png'), crop);
writePng(path.join(OUT, 'crop-lodge-2x.png'), scaleImage(crop, 2));
