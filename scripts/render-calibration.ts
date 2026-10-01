/**
 * 40×24 vignette painted with the same pack sheets the office uses.
 *   npx vite-node scripts/render-calibration.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { blit, createImage, getPixel, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';
import { packRoot } from './pack-paths';

const PACK = packRoot();
const OUT = path.resolve(import.meta.dirname, '../docs/design/tiny-farm/calibration-b-v3.png');
const TILE = 16;
const COLS = 40;
const ROWS = 24;

type Terrain = 'grass' | 'high' | 'water' | 'cliff' | 'path' | 'speck';

const grassSheet = readPng(path.join(PACK, 'Tileset/Tileset Grass Spring.png'));
const cliffSheet = readPng(path.join(PACK, 'Tileset/Tileset Grass Cliff Tileset Spring.png'));
const waterFlat = readPng(path.join(PACK, 'Tileset/Water tile.png'));

function crop(src: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = createImage(w, h);
  for (let yy = 0; yy < h; yy += 1) {
    const from = ((y + yy) * src.width + x) * 4;
    out.data.set(src.data.subarray(from, from + w * 4), yy * w * 4);
  }
  return out;
}

function tileOf(src: Rgba, col: number, row: number): Rgba {
  return crop(src, col * TILE, row * TILE, TILE, TILE);
}

/** Mask bit = that side is outside the fill. N=8 E=4 S=2 W=1. */
const BY_MASK: Record<number, [number, number]> = {
  0: [9, 10],
  8: [10, 8],
  4: [11, 10],
  2: [9, 11],
  1: [1, 9],
  12: [11, 8],
  9: [1, 8],
  6: [11, 11],
  3: [8, 11],
  5: [0, 9],
  10: [2, 11],
  7: [0, 10],
  11: [1, 11],
  13: [0, 8],
  14: [3, 11],
  15: [0, 11],
};
const INNER: Record<string, [number, number]> = {
  nw: [5, 9],
  ne: [6, 9],
  se: [6, 10],
  sw: [5, 10],
};

function sheetTile(src: Rgba, originCol: number, originRow: number, at: [number, number]): Rgba {
  return tileOf(src, originCol + at[0], originRow + (at[1] - 8));
}

const grid: Terrain[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 'grass' as Terrain));

function set(col: number, row: number, terrain: Terrain): void {
  if (row < 0 || col < 0 || row >= ROWS || col >= COLS) return;
  grid[row]![col] = terrain;
}

function fillRect(c0: number, r0: number, c1: number, r1: number, terrain: Terrain): void {
  for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) set(c, r, terrain);
}

fillRect(5, 0, 16, 2, 'high');
for (let c = 5; c <= 16; c += 1) {
  if (c >= 8 && c <= 11) continue;
  set(c, 3, 'cliff');
  set(c, 4, 'cliff');
  set(c, 5, 'water');
}
const river: readonly (readonly [number, number, number])[] = [
  [5, 8, 12],
  [6, 6, 14],
  [7, 5, 11],
  [8, 7, 13],
  [9, 9, 12],
];
for (const [r, c0, c1] of river) for (let c = c0; c <= c1; c += 1) if (grid[r]![c] === 'grass') set(c, r, 'water');
for (const [c, r] of [[6, 6], [14, 6], [5, 7], [11, 7], [7, 8], [13, 8]] as const) set(c, r, 'grass');

const pond = [
  [17, 13], [18, 13], [19, 13],
  [16, 14], [17, 14], [18, 14], [19, 14], [20, 14],
  [17, 15], [18, 15], [19, 15],
  [18, 16],
] as const;
for (const [c, r] of pond) if (grid[r]![c] === 'grass') set(c, r, 'water');

function pathSeg(x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    for (let r = Math.floor(y - 0.8); r <= Math.ceil(y + 0.8); r += 1) {
      for (let c = Math.floor(x - 0.8); c <= Math.ceil(x + 0.8); c += 1) {
        if (Math.hypot(c + 0.5 - x, r + 0.5 - y) > 1.05) continue;
        const cur = grid[r]?.[c];
        if (cur === 'grass' || cur === 'high' || cur === 'speck') set(c, r, 'path');
      }
    }
  }
}
pathSeg(28, 9, 28, 16);
pathSeg(28, 16, 8, 18);
pathSeg(28, 12, 18, 14);
pathSeg(22, 8, 28, 9);

const specks: readonly (readonly [number, number])[] = [
  [3, 12], [22, 16], [33, 14], [11, 11], [36, 18], [6, 20], [31, 20], [14, 19],
];
for (const [c, r] of specks) if (grid[r]![c] === 'grass') set(c, r, 'speck');

function at(col: number, row: number): Terrain | null {
  if (row < 0 || col < 0 || row >= ROWS || col >= COLS) return null;
  return grid[row]![col]!;
}

function maskOf(col: number, row: number, outside: (t: Terrain | null) => boolean): number {
  const bit = (dc: number, dr: number, flag: number) => (outside(at(col + dc, row + dr)) ? flag : 0);
  return bit(0, -1, 8) | bit(1, 0, 4) | bit(0, 1, 2) | bit(-1, 0, 1);
}

function autotile(
  src: Rgba,
  originCol: number,
  originRow: number,
  col: number,
  row: number,
  outside: (t: Terrain | null) => boolean,
): Rgba {
  let bits = maskOf(col, row, outside);
  let atCoord = BY_MASK[bits] ?? BY_MASK[0]!;
  if (bits === 0) {
    const diag = (dc: number, dr: number) => outside(at(col + dc, row + dr));
    if (diag(-1, -1)) atCoord = INNER.nw;
    else if (diag(1, -1)) atCoord = INNER.ne;
    else if (diag(1, 1)) atCoord = INNER.se;
    else if (diag(-1, 1)) atCoord = INNER.sw;
  }
  return sheetTile(src, originCol, originRow, atCoord);
}

const lightFlat = tileOf(grassSheet, 9, 2);
/** Dirt-face cliff, left block. Not cols 12–16, which are the dark arches. */
const cliffCapStraight = tileOf(cliffSheet, 9, 3);
const cliffCapWest = tileOf(cliffSheet, 1, 3);
const cliffCapEast = tileOf(cliffSheet, 3, 3);
/** (0,5) and (2,5) are the two halves of one wave. Mixing other feet breaks the line into a dark bar. */
const cliffFootLeft = tileOf(cliffSheet, 0, 5);
const cliffFootRight = tileOf(cliffSheet, 2, 5);
const cliffWallStraight = tileOf(cliffSheet, 9, 4);

function stamp(base: Rgba, over: Rgba): Rgba {
  const out = createImage(TILE, TILE);
  blit(out, base, 0, 0);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const color = getPixel(over, x, y);
      if (color < 0) continue;
      const red = (color >>> 16) & 255;
      const green = (color >>> 8) & 255;
      const blue = color & 255;
      if (red < 16 && green < 16 && blue < 16) continue;
      setPixel(out, x, y, color);
    }
  }
  return out;
}

function nearPath(col: number, row: number): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const t = at(col + dc, row + dr);
      if (t === 'path' || t === 'speck') return true;
    }
  }
  return false;
}

const darkCenters: readonly (readonly [number, number, number])[] = [
  [8, 11, 3.2], [22, 4, 2.4], [34, 10, 3.4], [4, 20, 3.2], [26, 20, 4.2], [14, 18, 2.6], [36, 18, 2.4], [30, 16, 2.2], [12, 8, 2.2],
];

/** Dark grass is the cols 12–23, rows 0–3 autotile laid over the light flat. The hole is the blend. */
function darkAt(col: number, row: number): boolean {
  if (at(col, row) !== 'grass' || nearPath(col, row)) return false;
  return darkCenters.some(([cx, cy, rad]) => {
    const dx = (col + 0.5 - cx) / rad;
    const dy = (row + 0.5 - cy) / (rad * 0.72);
    return dx * dx + dy * dy <= 1;
  });
}

function paintCliff(col: number, row: number): Rgba {
  const west = at(col - 1, row) === 'cliff';
  const east = at(col + 1, row) === 'cliff';
  const cap = !west && east ? cliffCapWest : west && !east ? cliffCapEast : cliffCapStraight;
  if (at(col, row - 1) !== 'cliff') return stamp(lightFlat, cap);
  if (at(col, row + 1) === 'water') return stamp(waterFlat, col % 2 === 0 ? cliffFootLeft : cliffFootRight);
  return cliffWallStraight;
}

function maskAt(col: number, row: number, outside: (c: number, r: number) => boolean): number {
  const bit = (dc: number, dr: number, flag: number) => (outside(col + dc, row + dr) ? flag : 0);
  return bit(0, -1, 8) | bit(1, 0, 4) | bit(0, 1, 2) | bit(-1, 0, 1);
}

function tileFor(src: Rgba, originCol: number, originRow: number, col: number, row: number, outside: (c: number, r: number) => boolean): Rgba {
  let bits = maskAt(col, row, outside);
  let atCoord = BY_MASK[bits] ?? BY_MASK[0]!;
  if (bits === 0) {
    if (outside(col - 1, row - 1)) atCoord = INNER.nw;
    else if (outside(col + 1, row - 1)) atCoord = INNER.ne;
    else if (outside(col + 1, row + 1)) atCoord = INNER.se;
    else if (outside(col - 1, row + 1)) atCoord = INNER.sw;
  }
  return sheetTile(src, originCol, originRow, atCoord);
}

function paint(col: number, row: number): Rgba {
  const terrain = at(col, row)!;
  if (terrain === 'water') return waterFlat;
  if (terrain === 'cliff') return paintCliff(col, row);
  if (terrain === 'path' || terrain === 'speck') {
    if (terrain === 'speck') return sheetTile(grassSheet, 0, 8, BY_MASK[15]!);
    return autotile(grassSheet, 0, 8, col, row, (t) => t !== 'path');
  }
  const wet = (c: number, r: number) => at(c, r) === 'water';
  const touches = [
    [0, -1], [1, 0], [0, 1], [-1, 0],
    [1, -1], [1, 1], [-1, 1], [-1, -1],
  ].some(([dc, dr]) => wet(col + dc!, row + dr!));
  // The decorated water sheet draws a brown-and-blue dither. B's pond is the plain
  // grass autotile over water: the hole is water, the fringe is only the dark outline.
  if (touches) return stamp(waterFlat, tileFor(grassSheet, 0, 0, col, row, wet));
  if (darkAt(col, row)) return stamp(lightFlat, tileFor(grassSheet, 12, 0, col, row, (c, r) => !darkAt(c, r)));
  return lightFlat;
}

const scene = createImage(COLS * TILE, ROWS * TILE);
for (let r = 0; r < ROWS; r += 1) {
  for (let c = 0; c < COLS; c += 1) {
    blit(scene, paint(c, r), c * TILE, r * TILE);
  }
}

function prop(rel: string, x: number, y: number, w: number, h: number): Rgba {
  return crop(readPng(path.join(PACK, rel)), x, y, w, h);
}

interface Sprite { img: Rgba; x: number; y: number }
const sprites: Sprite[] = [];
function place(img: Rgba, col: number, row: number, dx = 0, dy = 0): void {
  const feetX = col * TILE + TILE / 2 + dx;
  const feetY = (row + 1) * TILE + dy;
  sprites.push({ img, x: Math.round(feetX - img.width / 2), y: feetY - img.height });
}

const maple = 'Objects/Tree/Common/No Shadow/Maple Tree.png';
const trees: readonly (readonly [number, number, number])[] = [
  [0, 2, 8], [32, 22, 6], [128, 36, 7], [0, 12, 16], [96, 33, 12], [32, 6, 20],
];
for (const [ox, col, row] of trees) place(prop(maple, ox, 49, 32, 45), col, row);
place(prop('Crops/Fruits Tree/Summer/Orange Tree - no shadow.png', 128, 1, 32, 44), 13, 12);
place(prop('Crops/Fruits Tree/Summer/Orange Tree - no shadow.png', 96, 1, 32, 44), 21, 15);
place(prop('Crops/Fruits Tree/Spring/Cherry Tree.png', 96, 1, 32, 45), 11, 17);
place(prop('Crops/Fruits Tree/Summer/Banana Tree - no Shadow.png', 130, 0, 29, 45), 35, 17);

place(prop('Objects/Exterior/Houses/10.png', 0, 0, 80, 112), 28, 8);
place(prop('Objects/Exterior/Mailbox.png', 0, 14, 16, 18), 31, 8);
place(prop('Tileset/Spring Waterfall.png', 0, 0, 64, 64), 9, 6, 8);
place(prop('Objects/Exterior/Houses/dog house.png', 7, 2, 34, 42), 5, 16);
place(prop('Objects/Props/wood.png', 32, 1, 16, 14), 2, 1);

const rail = prop('Objects/Exterior/Fence and Bridge/Fence Wood.png', 48, 0, 48, 14);
for (const [col, row] of [[23, 9], [26, 9], [32, 9], [23, 5], [32, 5], [10, 11], [13, 11]] as const) {
  place(rail, col, row);
}
place(prop('Objects/Exterior/Village Clotheslines.png', 6, 10, 36, 20), 24, 19);
place(prop('Objects/Exterior/Hay Bales.png', 0, 0, 32, 16), 16, 20);
place(prop('Objects/Exterior/Box.png', 50, 77, 14, 19), 19, 20);
place(prop('Objects/Exterior/Box.png', 18, 77, 14, 19), 20, 20);
place(prop('Objects/Exterior/Street Lamp 2.png', 0, 1, 16, 37), 26, 14);
place(prop('Objects/Exterior/Street Lamp 2.png', 0, 1, 16, 37), 33, 16);

const flower = prop('Crops/Summer/Sunflower.png', 81, 5, 15, 26);
const bloom = prop('Crops/Spring/Spring Crops.png', 114, 18, 13, 13);
const mushroom = prop('Objects/Tree/Deep Forest/Fantasy Mushroom.png', 40, 20, 15, 24);
const stump = prop(maple, 9, 131, 14, 11);
const lily = prop('Objects/Props/Spring/props water.png', 0, 34, 16, 16);
const butterfly = prop('Animals/Forest/Bugs/Butterfly/Monarch Butterfly.png', 0, 0, 16, 16);
for (const [col, row] of [[6, 11], [30, 12], [19, 18], [3, 19], [36, 8], [12, 8]] as const) place(flower, col, row);
for (const [col, row] of [[9, 14], [25, 17], [34, 13], [4, 8], [37, 19], [15, 20], [2, 14], [33, 6]] as const) place(bloom, col, row);
for (const [col, row] of [[7, 13], [23, 15], [12, 20], [35, 11]] as const) place(mushroom, col, row);
for (const [col, row] of [[10, 10], [22, 12], [4, 18]] as const) place(stump, col, row);
for (const [col, row] of [[5, 7], [12, 7], [15, 8], [8, 8], [16, 13], [18, 13]] as const) place(lily, col, row);
for (const [col, row] of [[14, 10], [27, 15]] as const) place(butterfly, col, row);

sprites.sort((a, b) => a.y + a.img.height - (b.y + b.img.height));
for (const sprite of sprites) blit(scene, sprite.img, sprite.x, sprite.y);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
writePng(OUT, scaleImage(scene, 2));
console.warn('wrote', OUT, scene.width * 2, scene.height * 2);
