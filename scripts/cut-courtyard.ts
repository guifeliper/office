/**
 * Crop the courtyard slice into runtime art. Source sheets stay outside the repo.
 *
 *   npx vite-node scripts/cut-courtyard.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createImage, readPng, stats, writePng, type Rgba } from './png';
import { CACHE, packRoot } from './pack-paths';

const PACK = packRoot();
const YARD = path.join(CACHE, 'yard');

function sheet(rel: string): Rgba {
  return readPng(path.join(PACK, rel));
}

function crop(src: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = createImage(w, h);
  for (let yy = 0; yy < h; yy += 1) {
    const from = ((y + yy) * src.width + x) * 4;
    out.data.set(src.data.subarray(from, from + w * 4), yy * w * 4);
  }
  return out;
}

function over(dst: Rgba, src: Rgba, dx = 0, dy = 0): void {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const s = (y * src.width + x) * 4;
      if ((src.data[s + 3] ?? 0) < 128) continue;
      const d = ((y + dy) * dst.width + (x + dx)) * 4;
      if (d < 0 || x + dx >= dst.width || y + dy >= dst.height) continue;
      dst.data.set([src.data[s]!, src.data[s + 1]!, src.data[s + 2]!, 255], d);
    }
  }
}

function fill(img: Rgba, color: number): void {
  const rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255, 255];
  for (let i = 0; i < img.width * img.height; i += 1) img.data.set(rgb, i * 4);
}

function snapAlpha(img: Rgba): Rgba {
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = (img.data[i] ?? 0) >= 128 ? 255 : 0;
  return img;
}

/** Drop empty margins so the anchor sits on the last opaque row. */
function tight(img: Rgba): Rgba {
  snapAlpha(img);
  const box = stats(img).opaqueBox;
  if (!box) return img;
  if (box.x === 0 && box.y === 0 && box.w === img.width && box.h === img.height) return img;
  return crop(img, box.x, box.y, box.w, box.h);
}

function write(name: string, img: Rgba, trim = false): void {
  const out = trim ? tight(img) : snapAlpha(img);
  writePng(path.join(YARD, `${name}.png`), out);
  img = out;
  const s = stats(img);
  const b = s.opaqueBox;
  console.warn(`${name.padEnd(16)} ${img.width}×${img.height} opaque=${b ? `${b.w}×${b.h}@${b.x},${b.y}` : '-'} colors=${s.colors}`);
}

function rgbOf(img: Rgba): number[] {
  const colors: number[] = [];
  for (let i = 0; i < img.width * img.height; i += 1) {
    const o = i * 4;
    if (img.data[o + 3] !== 255) throw new Error('yard ground tile has transparency');
    colors.push((img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!);
  }
  return colors;
}

fs.mkdirSync(YARD, { recursive: true });

const grass = readPng(path.join(CACHE, 'tiles/grass-0.png'));
const GRASS = (grass.data[0]! << 16) | (grass.data[1]! << 8) | grass.data[2]!;

const waterSheet = sheet('Tileset/Tileset Grass Water Summer.png');
const house = sheet('Tileset/Tileset House.png');
const tile = (src: Rgba, col: number, row: number) => crop(src, col * 16, row * 16, 16, 16);

/** Shore tiles are mostly grass with a water edge. Fill the sheet's holes with pack grass. */
function shore(col: number, row: number): Rgba {
  const out = createImage(16, 16);
  fill(out, GRASS);
  over(out, tile(waterSheet, col, row));
  return out;
}

const beachTiles = sheet('Tileset/Beach animations tiles.png');

const ground: Record<string, Rgba> = {
  water: sheet('Tileset/Water tile.png'),
  'shore-n': shore(2, 2),
  'shore-s': shore(0, 6),
  'shore-w': shore(7, 1),
  'shore-e': shore(4, 1),
  'shore-nw': shore(3, 0),
  'shore-ne': shore(1, 0),
  roof: tile(house, 1, 1),
  'roof-b': tile(house, 2, 1),
  'roof-edge': tile(house, 4, 0),
  step: tile(house, 17, 2),
  sand: tile(beachTiles, 12, 12),
};

function forceOpaque(img: Rgba): Rgba {
  let fill = 0xc4a574;
  for (let i = 0; i < img.width * img.height; i += 1) {
    const o = i * 4;
    if (img.data[o + 3] === 255) {
      fill = (img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!;
      break;
    }
  }
  const out = createImage(img.width, img.height);
  for (let i = 0; i < img.width * img.height; i += 1) {
    const o = i * 4;
    const src = (img.data[o + 3] ?? 0) === 0 ? fill : ((img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!);
    out.data[o] = (src >>> 16) & 255;
    out.data[o + 1] = (src >>> 8) & 255;
    out.data[o + 2] = src & 255;
    out.data[o + 3] = 255;
  }
  return out;
}

const packed: Record<string, number[]> = {};
for (const [name, img] of Object.entries(ground)) {
  const tileImg = name === 'sand' ? forceOpaque(img) : img;
  if (tileImg.width !== 16 || tileImg.height !== 16) throw new Error(`${name} is ${tileImg.width}×${tileImg.height}`);
  write(name, tileImg);
  packed[name] = rgbOf(tileImg);
}

const fence = sheet('Objects/Exterior/Fence and Bridge/Fence Wood.png');
write('fence', crop(fence, 48, 0, 48, 14), true);
const post = tight(crop(fence, 48, 28, 16, 20));
write('gate-post', post);
{
  const base = createImage(64, post.height);
  over(base, post, 2, 0);
  over(base, post, 48 + 2, 0);
  write('gatehouse-base', base);
  const rail = tight(crop(fence, 64, 0, 32, 14));
  const lintel = createImage(64, rail.height);
  over(lintel, rail, 0, 0);
  over(lintel, rail, 32, 0);
  write('gatehouse-lintel', lintel);
}

const roofTile = tile(house, 1, 1);
const roofAlt = tile(house, 2, 1);
const lodgeRoof = createImage(22 * 16, 32);
for (let row = 0; row < 2; row += 1) {
  for (let col = 0; col < 22; col += 1) {
    over(lodgeRoof, (col + row) % 2 === 0 ? roofTile : roofAlt, col * 16, row * 16);
  }
}
write('lodge-roof', lodgeRoof);
write('lodge-door', crop(sheet('Objects/Exterior/Houses/Door, windows, and chimney/Door.png'), 0, 3, 48, 23), true);
// Premade cottage: orange walls, brown roof, stone chimney, round attic window, green awning.
write('lodge-house', sheet('Objects/Exterior/Houses/10.png'), true);
write('fishman', crop(sheet('Objects/Exterior/Houses/NPCS houses/Fishman/Fishman house.png'), 0, 0, 80, 112), true);
const maple = sheet('Objects/Tree/Common/No Shadow/Maple Tree.png');
write('maple-canopy-0', crop(maple, 0, 49, 32, 27));
write('maple-canopy-1', crop(maple, 32, 49, 32, 27));
write('maple-canopy-2', crop(maple, 128, 49, 32, 27));
write('maple-trunk', crop(maple, 0, 76, 32, 18));

const fire = sheet('Objects/Exterior/Mine and Dungeon/bonfire.png');
for (let i = 0; i < 6; i += 1) write(`bonfire-${i}`, crop(fire, i * 16, 0, 16, 32), true);

const pine = sheet('Objects/Tree/Common/No Shadow/Pine Tree.png');
write('stump', crop(pine, 203, 37, 10, 10), true);
write('woodpile', crop(sheet('Objects/Props/wood.png'), 32, 1, 16, 14), true);

const soil = tile(sheet('Tileset/Tilled Soil and wet soil.png'), 9, 1);
const bed = createImage(48, 32);
for (let row = 0; row < 2; row += 1) {
  for (let col = 0; col < 3; col += 1) over(bed, soil, col * 16, row * 16);
}
write('garden-bed', bed);

write('meeting-table', crop(sheet('Objects/Exterior/Picnic.png'), 2, 2, 44, 44), true);
write('rock', crop(sheet('Objects/Props/Spring/Stones.png'), 6, 4, 25, 19), true);
write('shore-rock', crop(sheet('Objects/Props/Spring/Ground stones.png'), 18, 2, 14, 14), true);

const bushes = sheet('Objects/Tree/Deep Forest/bushes.png');
write('bush-a', crop(bushes, 9, 0, 32, 31), true);
write('bush-b', crop(bushes, 57, 0, 32, 31), true);

write('bridge', crop(sheet('Objects/Exterior/Fence and Bridge/Bridge.png'), 13, 0, 70, 50), true);
write('mailbox', crop(sheet('Objects/Exterior/Mailbox.png'), 0, 14, 16, 18), true);
write('lantern', crop(sheet('Objects/Exterior/Street Lamp 2.png'), 0, 1, 16, 37), true);
write('flower', crop(sheet('Crops/Summer/Sunflower.png'), 81, 5, 15, 26), true);
write('bloom', crop(sheet('Crops/Spring/Spring Crops.png'), 114, 18, 13, 13), true);
write('mushroom', crop(sheet('Objects/Tree/Deep Forest/Fantasy Mushroom.png'), 40, 20, 15, 24), true);
write('banana', crop(sheet('Crops/Fruits Tree/Summer/Banana Tree - no Shadow.png'), 130, 0, 29, 45), true);
write('cherry', crop(sheet('Crops/Fruits Tree/Spring/Cherry Tree.png'), 96, 1, 32, 45), true);
write('fruit-tree', crop(sheet('Crops/Fruits Tree/Summer/Orange Tree - no shadow.png'), 128, 1, 32, 44), true);
const waterProps = sheet('Objects/Props/Spring/props water.png');
const lilyFrames: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 15, 14],
  [0, 18, 15, 14],
  [0, 34, 15, 14],
  [0, 49, 15, 14],
];
lilyFrames.forEach(([x, y, w, h], i) => write(`lily-${i}`, crop(waterProps, x, y, w, h), true));
write('lily', crop(waterProps, 0, 1, 15, 14), true);
const reedFrames: readonly (readonly [number, number, number, number])[] = [
  [19, 66, 13, 11],
  [19, 83, 13, 12],
  [19, 99, 13, 11],
  [19, 114, 13, 12],
];
reedFrames.forEach(([x, y, w, h], i) => write(`reed-${i}`, crop(waterProps, x, y, w, h), true));
write('reed', crop(waterProps, 19, 66, 13, 11), true);
const berries = sheet('Crops/Spring/Strawberry.png');
[0, 1, 3, 5].forEach((col, i) => write(`crop-${i}`, crop(berries, col * 16, 0, 16, 16), true));
write('hay', crop(sheet('Objects/Exterior/Hay Bales.png'), 0, 0, 32, 16), true);
write('laundry', crop(sheet('Objects/Exterior/Village Clotheslines.png'), 6, 10, 36, 20), true);
write('crate', crop(sheet('Objects/Exterior/Box.png'), 50, 77, 14, 19), true);
const monarch = sheet('Animals/Forest/Bugs/Butterfly/Monarch Butterfly.png');
for (let i = 0; i < 4; i += 1) write('butterfly-' + i, crop(monarch, i * 16, 0, 16, 16), true);
write('butterfly', crop(monarch, 0, 0, 16, 16), true);
write('greenhouse', crop(sheet('Objects/Exterior/Houses/Farm Buildings/Greenhouse/Greenhouse.png'), 15, 7, 60, 81), true);
write('canoe', crop(sheet('Objects/Exterior/Beach/wood canoe.png'), 1, 2, 29, 43), true);
write('pier', crop(sheet('Objects/Exterior/Fence and Bridge/Bridge Beach.png'), 0, 96, 48, 14), true);
write('sandcastle', crop(sheet('Objects/Exterior/Beach/Sandcastle.png'), 1, 3, 15, 29), true);
write('waterfall', crop(sheet('Tileset/Summer Waterfall.png'), 0, 64, 64, 48), true);
write('doghouse', crop(sheet('Objects/Exterior/Houses/dog house.png'), 7, 2, 34, 42), true);
write('pine', crop(sheet('Objects/Tree/Common/No Shadow/Pine Tree.png'), 68, 14, 23, 32), true);
write('palm', crop(sheet('Objects/Exterior/Beach/Coconut Tree.png'), 3, 9, 72, 35), true);
write('bench', crop(sheet('Objects/Exterior/Beach/Wooden Bench.png'), 36, 7, 24, 18), true);
write('stall', sheet('Objects/Exterior/Newsstand.png'), true);
write('barrel', crop(sheet('Objects/Exterior/Beach/Fish Barrel.png'), 9, 8, 15, 18), true);
write('starfish', crop(sheet('Icons/Fish/Sea/Creatures/Starfish.png'), 1, 17, 13, 13), true);

const body = `/** Courtyard ground tiles cut from the Tiny Farm pack. Generated by scripts/cut-courtyard.ts. */
function rgb(hex: string): Int32Array {
  const out = new Int32Array(hex.length / 6);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 6, i * 6 + 6), 16);
  return out;
}

export const YARD_GROUND = {
${Object.entries(packed).map(([name, colors]) => `  '${name}': rgb('${colors.map((c) => c.toString(16).padStart(6, '0')).join('')}'),`).join('\n')}
} as const;

export type YardGroundName = keyof typeof YARD_GROUND;
`;
fs.mkdirSync(path.join(CACHE, 'tiles'), { recursive: true });
fs.writeFileSync(path.join(CACHE, 'tiles/yard-ground.ts'), body);
console.warn('wrote', YARD);
