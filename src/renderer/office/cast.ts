/**
 * Round-4 cast. Every pose starts from the approved body matrix.
 * Recolor swaps a material's 3-tone ramp and does not move a pixel.
 * The walk, the tools and the campfire seat are new drawings on that body.
 */
import {
  EAST,
  INK,
  NORTH,
  PALETTE,
  SIT_NORTH,
  SOUTH,
  paintMatrix,
  type BodyMatrix,
  type Material,
  type Rgba,
} from '../../../scripts/body-art';
import type { Appearance, Facing } from './paper-doll';

type Ramp = readonly [number, number, number];

const lum = (c: number) => 0.2126 * ((c >>> 16) & 0xff) + 0.7152 * ((c >>> 8) & 0xff) + 0.0722 * (c & 0xff);
const br = (c: number) => (c & 0xff) - ((c >>> 16) & 0xff);

/** Approved skin, then four more. Dark stays cooler than light. */
export const SKIN_RAMPS: readonly Ramp[] = [
  PALETTE.skin,
  [0xf0c8a8, 0xd0a888, 0xa08078],
  [0xe0b080, 0xc09068, 0x907060],
  [0xc08060, 0xa06848, 0x705048],
  [0x8d5a42, 0x6e4534, 0x503038],
];

export const HAIR_RAMPS: readonly Ramp[] = [
  PALETTE.hair,
  [0x4a403c, 0x2c2624, 0x1c1830],
  [0xc06048, 0x8a3830, 0x502848],
  [0xf0d090, 0xc49858, 0x887060],
  [0xd0ccc4, 0x98948c, 0x686480],
];

/**
 * Four outfits. Every tone stays ≥ 40 luminance off mid grass, the path, and both woods.
 * Shirt 0 keeps the approved indigo mid and dark; only the light tone is darkened.
 */
export const OUTFIT_RAMPS: readonly { shirt: Ramp; pants: Ramp }[] = [
  { shirt: [0x664c78, 0x4e4a7e, 0x242e58], pants: [0x584838, 0x403428, 0x282028] },
  { shirt: [0x2e584c, 0x244840, 0x163048], pants: [0x3c4438, 0x2c3428, 0x1c2428] },
  { shirt: [0x3e5260, 0x32424e, 0x183050], pants: [0x504438, 0x3c3428, 0x241c28] },
  { shirt: [0x684040, 0x543030, 0x382030], pants: [0x544038, 0x403028, 0x2c2028] },
];

/** 0 none. Crown of each hat is at least 4 px. Greens are not the grass ramp; straw is not lodge wood. */
export const HAT_RAMPS: readonly (readonly [number, number] | null)[] = [
  null,
  [0x6a8a58, 0x3a5830],
  [0x4a4440, 0x2a2828],
  [0xd4b06a, 0xa08040],
];

const GLASS = 0x3a444c;
const PIN = 0xd4a04a;
/** Handle 2×10 and head 4×3. The can is a separate color from the drops. */
export const AXE_HANDLE = 0x5a3a2a;
export const AXE_HEAD = 0x8a5a30;
export const CAN_COLOR = 0x4a7c9b;
export const DROP_COLOR = 0x7ab4d4;

/** Mid grass, path, and the two woods a shirt is read against. */
const GROUND = [0x5b8f4e, 0xd9c4a4, 0xe6c49a, 0xc4925a];

export const STILL: Record<Facing, BodyMatrix> = {
  south: SOUTH,
  north: NORTH,
  east: EAST,
  west: { ...EAST, rows: EAST.rows.map((row) => [...row].reverse().join('')) },
};

export function rampsFor(appearance: Appearance): Record<Material, Ramp> {
  const skin = SKIN_RAMPS[appearance.skin] ?? SKIN_RAMPS[0]!;
  const hair = HAIR_RAMPS[appearance.hair] ?? HAIR_RAMPS[0]!;
  const outfit = OUTFIT_RAMPS[appearance.outfit] ?? OUTFIT_RAMPS[0]!;
  return { skin, hair, shirt: outfit.shirt, pants: outfit.pants, shoe: PALETTE.shoe };
}

export function hueShiftOk(ramp: Ramp): boolean {
  return br(ramp[2]) - br(ramp[0]) >= 15 && lum(ramp[0]) > lum(ramp[1]) && lum(ramp[1]) > lum(ramp[2]);
}

export function contrastOk(color: number): boolean {
  return GROUND.every((g) => Math.abs(lum(color) - lum(g)) >= 40);
}

function clone(matrix: BodyMatrix): BodyMatrix {
  return { left: matrix.left, top: matrix.top, rows: matrix.rows.slice() };
}

/**
 * Shape 1: a 4 px bun on the crown. Shine and the step stay where they are.
 * Shape 2: a long lock on the back (indices 6–10) and a short one on the other side.
 */
export function shapeMatrix(matrix: BodyMatrix, shape: number, facing: Facing = 'south'): BodyMatrix {
  if (shape === 1) {
    const crown = matrix.rows[0]!.indexOf('A');
    const row = '.'.repeat(matrix.rows[0]!.length).split('');
    for (let i = 0; i < 4; i += 1) if (crown >= 0) row[crown + i] = 'h';
    return { left: matrix.left, top: matrix.top - 1, rows: [row.join(''), ...matrix.rows] };
  }
  if (shape === 2) {
    const rows = matrix.rows.map((row, j) => {
      const long = j >= 6 && j <= 10 ? 'hh' : '..';
      const short = j >= 8 && j <= 10 ? 'hh' : '..';
      return facing === 'west' ? short + row + long : long + row + short;
    });
    return { left: matrix.left - 2, top: matrix.top, rows };
  }
  return matrix;
}

/**
 * The whole torso rises `dy` px. A copy of the waist is inserted so the shoes
 * stay on row 55 and row 56 stays empty. The head, the step and the hands move together.
 */
function bobBody(matrix: BodyMatrix, dy: number): BodyMatrix {
  if (dy <= 0) return matrix;
  const waist = Math.min(24, matrix.rows.length - 1);
  const hinge = matrix.rows[waist]!;
  return {
    left: matrix.left,
    top: matrix.top - dy,
    rows: [...matrix.rows.slice(0, waist), ...Array.from({ length: dy }, () => hinge), ...matrix.rows.slice(waist)],
  };
}

/** Breath is the chest only. Hands and the seat stay put. */
function breath(matrix: BodyMatrix): BodyMatrix {
  const chest = Math.min(18, matrix.rows.length - 1);
  const hinge = matrix.rows[chest]!;
  return {
    left: matrix.left,
    top: matrix.top - 1,
    rows: [...matrix.rows.slice(0, chest), hinge, ...matrix.rows.slice(chest)],
  };
}

const SHOE = new Set(['O', 'o', 'Q']);

interface Shoe {
  x: number;
  shape: string[];
}

/** Each sole run, top to bottom, so the whole shoe can be blitted to a new origin. */
function extractShoes(rows: readonly string[]): Shoe[] {
  const sole = rows[rows.length - 1] ?? '';
  const shoes: Shoe[] = [];
  let start = -1;
  for (let i = 0; i <= sole.length; i += 1) {
    const on = i < sole.length && SHOE.has(sole[i]!);
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      const shape: string[] = [];
      for (let y = rows.length - 1; y >= 0; y -= 1) {
        let any = false;
        let slice = '';
        for (let x = start; x < i; x += 1) {
          const ch = rows[y]![x] ?? '.';
          if (SHOE.has(ch)) {
            any = true;
            slice += ch;
          } else slice += '.';
        }
        if (!any) break;
        shape.unshift(slice);
      }
      if (shape.length) shoes.push({ x: start, shape });
      start = -1;
    }
  }
  return shoes;
}

function blitShoes(rows: readonly string[], placements: { shoe: Shoe; x: number; soleY: number }[]): string[] {
  const grid = rows.map((row) => [...row]);
  for (const row of grid) {
    for (let x = 0; x < row.length; x += 1) if (SHOE.has(row[x]!)) row[x] = '.';
  }
  for (const place of placements) {
    const top = place.soleY - place.shoe.shape.length + 1;
    place.shoe.shape.forEach((slice, j) => {
      const y = top + j;
      const line = grid[y];
      if (!line) return;
      [...slice].forEach((ch, i) => {
        const x = place.x + i;
        if (ch !== '.' && x >= 0 && x < line.length) line[x] = ch;
      });
    });
  }
  return grid.map((row) => row.join(''));
}

/**
 * Contact (0, 3): one sole on the ground, the other `lift` px higher, both pushed outward.
 * Passing (1, 2, 4, 5): the moving sole rises 5 or 6 px.
 */
function stepFeet(rows: readonly string[], phase: number, profile: boolean): string[] {
  const shoes = extractShoes(rows);
  const left = shoes[0];
  const right = shoes[1];
  if (!left || !right) return rows.slice();
  const last = rows.length - 1;
  const contact = phase === 0 || phase === 3;
  const lift = contact ? 4 : phase === 2 || phase === 5 ? 6 : 5;
  const spread = contact ? 2 : 0;
  const lead = phase < 3;
  const leftDown = profile ? !lead : lead;
  return blitShoes(rows, [
    { shoe: left, x: left.x - spread, soleY: leftDown ? last : last - lift },
    { shoe: right, x: right.x + spread, soleY: leftDown ? last - lift : last },
  ]);
}

const SKIN_CODE = new Set(['S', 's', 'z']);

function shiftBox(
  rows: readonly string[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  dx: number,
  dy: number,
): string[] {
  const grid = rows.map((row) => [...row]);
  const cells: { x: number; y: number; ch: string }[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const ch = rows[y]?.[x];
      if (!ch || ch === '.') continue;
      cells.push({ x, y, ch });
    }
  }
  for (const cell of cells) grid[cell.y]![cell.x] = '.';
  for (const cell of cells) {
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const line = grid[ny];
    if (!line || nx < 0 || nx >= line.length) continue;
    line[nx] = cell.ch;
  }
  return grid.map((row) => row.join(''));
}

function skinBoxes(rows: readonly string[]): { x0: number; x1: number; y0: number; y1: number }[] {
  const seen = new Set<string>();
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const yMin = Math.floor(rows.length * 0.62);
  for (let y = yMin; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y]!.length; x += 1) {
      if (!SKIN_CODE.has(rows[y]![x]!) || seen.has(`${x},${y}`)) continue;
      const stack: [number, number][] = [[x, y]];
      seen.add(`${x},${y}`);
      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        x0 = Math.min(x0, cx);
        x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy);
        y1 = Math.max(y1, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (ny < yMin || ny >= rows.length || nx < 0 || nx >= rows[ny]!.length) continue;
          if (!SKIN_CODE.has(rows[ny]![nx]!) || seen.has(`${nx},${ny}`)) continue;
          seen.add(`${nx},${ny}`);
          stack.push([nx, ny]);
        }
      }
      if (x1 - x0 + 1 >= 3 && y1 - y0 + 1 >= 3) boxes.push({ x0, x1, y0, y1 });
    }
  }
  boxes.sort((a, b) => a.x0 - b.x0);
  return boxes;
}

/**
 * 6 frames. Contact plants one foot and lifts the other ≥ 4 px, spread apart.
 * Passing lifts the moving foot 5–6 px. The torso bobs 1 px, then 2. The opposite arm swings ≥ 2 px.
 * West is the east cycle, mirrored.
 */
export function walkMatrix(facing: Facing, frame: number): BodyMatrix {
  const phase = frame % 6;
  const profile = facing === 'east' || facing === 'west';
  let matrix = clone(profile ? EAST : STILL[facing]);
  if (profile) matrix = { ...matrix, rows: matrix.rows.map((row) => `${row}....`) };
  const bob = phase === 2 || phase === 5 ? 2 : phase === 1 || phase === 4 ? 1 : 0;
  if (bob) matrix = bobBody(matrix, bob);
  matrix = { ...matrix, rows: stepFeet(matrix.rows, phase, profile) };
  matrix = { ...matrix, rows: swingArms(matrix.rows, phase, profile) };
  if (facing === 'west') {
    const width = matrix.rows[0]!.length;
    matrix = {
      left: 47 - (matrix.left + width - 1),
      top: matrix.top,
      rows: matrix.rows.map((row) => [...row].reverse().join('')),
    };
  }
  return matrix;
}

function swingArms(rows: readonly string[], phase: number, profile: boolean): string[] {
  const hands = skinBoxes(rows);
  if (!hands.length) return rows.slice();
  const swing = phase === 2 || phase === 5 ? 3 : 2;
  const lead = phase < 3;
  if (profile || hands.length < 2) {
    const hand = hands[hands.length - 1]!;
    return shiftBox(rows, hand.x0, hand.x1, hand.y0, hand.y1, (lead ? -1 : 1) * swing, 0);
  }
  const left = hands[0]!;
  const right = hands[hands.length - 1]!;
  const swung = shiftBox(rows, left.x0, left.x1, left.y0, left.y1, 0, lead ? -swing : swing);
  return shiftBox(swung, right.x0, right.x1, right.y0, right.y1, 0, lead ? swing : -swing);
}

/** Odd frames drop the desk hand 1 px. */
export function typingMatrix(frame: number): BodyMatrix {
  const matrix = clone(SIT_NORTH);
  if (frame % 2 === 0) return matrix;
  return { ...matrix, rows: shiftBox(matrix.rows, 0, 2, 12, 14, 0, 1) };
}

function fill(grid: string[][], x: number, y: number, w: number, h: number, ch: string): void {
  for (let j = 0; j < h; j += 1) {
    const row = grid[y + j];
    if (!row) continue;
    for (let i = 0; i < w; i += 1) if (x + i >= 0 && x + i < row.length) row[x + i] = ch;
  }
}

/** 2 px wide sleeve from the shoulder to the new hand. The hand is painted after, so skin wins. */
function sleeve(grid: string[][], x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= steps; s += 1) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    const row = grid[y];
    if (!row) continue;
    if (x >= 0 && x < row.length) row[x] = 't';
    if (x + 1 >= 0 && x + 1 < row.length) row[x + 1] = 'D';
  }
}

/**
 * Side sit, facing the fire. Both hands reach forward. Frames 1 and 3 breathe the chest 1 px.
 * The head stays full height; this is not the desk sit.
 */
export function campfireMatrix(frame: number): BodyMatrix {
  const width = 24;
  const grid = EAST.rows.map((row) => [...`${row}${'.'.repeat(width - row.length)}`]);
  for (let y = 21; y <= 23; y += 1) for (let x = 11; x < 16; x += 1) grid[y]![x] = '.';
  for (let y = 25; y <= 31; y += 1) for (let x = 0; x < width; x += 1) grid[y]![x] = '.';
  sleeve(grid, 12, 20, 18, 23);
  fill(grid, 18, 24, 3, 3, 's');
  grid[24]![18] = 'S';
  grid[24]![19] = 'S';
  grid[24]![20] = 'S';
  grid[26]![18] = 'z';
  grid[26]![19] = 'z';
  grid[26]![20] = 'z';
  sleeve(grid, 12, 22, 15, 26);
  fill(grid, 15, 27, 3, 3, 's');
  grid[27]![15] = 'S';
  grid[27]![16] = 'S';
  grid[27]![17] = 'S';
  grid[29]![15] = 'z';
  grid[29]![16] = 'z';
  grid[29]![17] = 'z';
  fill(grid, 4, 28, 11, 1, 'P');
  fill(grid, 6, 29, 10, 1, 'p');
  fill(grid, 8, 30, 8, 1, 'q');
  fill(grid, 4, 31, 5, 1, 'Q');
  fill(grid, 10, 31, 7, 1, 'q');
  const matrix: BodyMatrix = { left: EAST.left, top: EAST.top, rows: grid.map((row) => row.join('')) };
  return frame % 2 === 1 ? breath(matrix) : matrix;
}

const AXE_PAD = 10;

/** The arm is redrawn per frame. 0 is the rest (the hold). 1 winds up, 2 hits, 3 follows through. */
export function axeMatrix(frame: number): BodyMatrix {
  const grid = NORTH.rows.map((row) => [...`${'.'.repeat(AXE_PAD)}${row}`]);
  for (let y = 21; y <= 23; y += 1) for (let x = AXE_PAD; x <= AXE_PAD + 2; x += 1) grid[y]![x] = '.';
  const poses: { shoulder: [number, number]; hand: [number, number] }[] = [
    { shoulder: [11, 20], hand: [6, 26] },
    { shoulder: [11, 20], hand: [3, 6] },
    { shoulder: [11, 20], hand: [7, 23] },
    { shoulder: [11, 20], hand: [5, 16] },
  ];
  const pose = poses[frame] ?? poses[0]!;
  const [sx, sy] = pose.shoulder;
  const [hx, hy] = pose.hand;
  sleeve(grid, sx, sy, hx + 1, hy);
  fill(grid, hx, hy, 3, 3, 's');
  grid[hy]![hx!] = 'S';
  grid[hy]![hx! + 1] = 'S';
  grid[hy]![hx! + 2] = 'S';
  grid[hy! + 2]![hx!] = 'z';
  grid[hy! + 2]![hx! + 1] = 'z';
  grid[hy! + 2]![hx! + 2] = 'z';
  return { left: NORTH.left - AXE_PAD, top: NORTH.top, rows: grid.map((row) => row.join('')) };
}

export interface ToolPixel {
  i: number;
  j: number;
  color: number;
}

function rect(into: ToolPixel[], i: number, j: number, w: number, h: number, color: number): void {
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) into.push({ i: i + x, j: j + y, color });
}

/** Handle 2×10 against the redrawn hand. Head 4×3 at the end of the handle, not on the hand. */
export function axeTools(frame: number): ToolPixel[] {
  const tools: ToolPixel[] = [];
  const spec = [
    { handle: [4, 19], head: [2, 29] },
    { handle: [1, 3], head: [0, 0] },
    { handle: [5, 19], head: [3, 29] },
    { handle: [3, 12], head: [1, 22] },
  ][frame] ?? { handle: [4, 19], head: [2, 29] };
  rect(tools, spec.handle[0]!, spec.handle[1]!, 2, 10, AXE_HANDLE);
  rect(tools, spec.head[0]!, spec.head[1]!, 4, 3, AXE_HEAD);
  return tools;
}

/**
 * Kneel on the approved south body. The head stays at y24, the torso is the full 32 px,
 * the hips fold 2 px, and the right arm reaches to the can.
 */
export function gardenMatrix(frame: number): BodyMatrix {
  const pad = 8;
  const width = 16 + pad;
  const grid = SOUTH.rows.map((row) => [...`${row}${'.'.repeat(pad)}`]);
  for (let y = 21; y <= 23; y += 1) for (let x = 13; x <= 15; x += 1) grid[y]![x] = '.';
  const lower = [
    '.ttttttttttt',
    '..PPPp....pPPP',
    '..Pqqq....qqqP',
    '..pqq......qqp',
    '..oOO......OOo',
    '...oo......oo',
    '....q......q',
    '....qq....qq',
  ];
  lower.forEach((spec, k) => {
    const row = grid[24 + k];
    if (!row) return;
    for (let x = 0; x < width; x += 1) row[x] = x < spec.length ? spec[x]! : '.';
  });
  const drop = frame === 2 ? 1 : 0;
  for (let x = 16; x <= 18; x += 1) grid[20]![x] = 'D';
  for (let x = 16; x <= 19; x += 1) grid[21]![x] = 't';
  for (let x = 17; x <= 20; x += 1) grid[22]![x] = 't';
  for (let x = 18; x <= 20; x += 1) grid[23 + drop]![x] = 'D';
  fill(grid, 19, 25 + drop, 3, 3, 's');
  const hy = 25 + drop;
  grid[hy]![19] = 'S';
  grid[hy]![20] = 'S';
  grid[hy]![21] = 'S';
  grid[hy + 2]![19] = 'z';
  grid[hy + 2]![20] = 'z';
  grid[hy + 2]![21] = 'z';
  return { left: SOUTH.left, top: SOUTH.top, rows: grid.map((row) => row.join('')) };
}

/** Can against the extended hand. Two or three drops in one cluster, a row below the spout. */
export function gardenTools(frame: number): ToolPixel[] {
  const tools: ToolPixel[] = [];
  const drop = frame === 2 ? 1 : 0;
  rect(tools, 20, 22 + drop, 4, 3, CAN_COLOR);
  const y = 29 + (frame === 1 ? 1 : 0);
  const x = 21 + (frame === 2 ? 1 : 0);
  rect(tools, x, y, 2, 1, DROP_COLOR);
  tools.push({ i: x + 1, j: y + 1, color: DROP_COLOR });
  return tools;
}

function stamp(img: Rgba, x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const o = (y * img.width + x) * 4;
  img.data[o] = (color >>> 16) & 0xff;
  img.data[o + 1] = (color >>> 8) & 0xff;
  img.data[o + 2] = color & 0xff;
  img.data[o + 3] = 255;
}

function colorAt(img: Rgba, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return -1;
  const o = (y * img.width + x) * 4;
  if (img.data[o + 3] === 0) return -1;
  return (img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!;
}

function opaqueBox(img: Rgba): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
    if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function wear(img: Rgba, appearance: Appearance): Rgba {
  const hat = HAT_RAMPS[appearance.hat] ?? null;
  const box = opaqueBox(img);
  if (!box) return img;
  if (hat) {
    const x0 = box.minX + 3;
    const x1 = box.maxX - 3;
    for (let y = box.minY; y < box.minY + 4; y += 1) {
      for (let x = x0; x <= x1; x += 1) if (colorAt(img, x, y) >= 0) stamp(img, x, y, y === box.minY ? hat[0] : hat[1]);
    }
    if (box.minY < 27) for (let x = x0; x <= x1; x += 1) stamp(img, x, box.minY - 1, hat[0]);
    if (appearance.hat === 1 || appearance.hat === 3) {
      const reach = appearance.hat === 3 ? 3 : 1;
      for (let x = box.minX - reach; x <= box.maxX + reach; x += 1) stamp(img, x, box.minY + 2, hat[1]);
    }
  }
  if (appearance.accessory === 1) {
    for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
      if (colorAt(img, x, y) !== INK) continue;
      stamp(img, x - 1, y, GLASS);
      stamp(img, x + 2, y, GLASS);
    }
  } else if (appearance.accessory === 2) {
    const scarf = (OUTFIT_RAMPS[appearance.outfit] ?? OUTFIT_RAMPS[0]!).shirt[2];
    for (let y = box.minY + 14; y <= box.minY + 16; y += 1) {
      for (let x = box.minX + 4; x <= box.maxX - 4; x += 1) {
        if (colorAt(img, x, y) >= 0) stamp(img, x, y, scarf);
      }
    }
  } else if (appearance.accessory === 3) {
    for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) {
      const px = box.minX + 6 + x;
      const py = box.minY + 18 + y;
      if (colorAt(img, px, py) >= 0) stamp(img, px, py, PIN);
    }
  }
  return img;
}

export function stampTools(img: Rgba, matrix: BodyMatrix, tools: readonly ToolPixel[]): void {
  for (const tool of tools) stamp(img, matrix.left + tool.i, matrix.top + tool.j, tool.color);
}

export function paintPose(
  matrix: BodyMatrix,
  appearance: Appearance,
  facing: Facing = 'south',
  tools: readonly ToolPixel[] = [],
): Rgba {
  const img = wear(paintMatrix(shapeMatrix(matrix, appearance.hairShape, facing), rampsFor(appearance)).image, appearance);
  stampTools(img, matrix, tools);
  return img;
}

export const BASE_LOOK: Appearance = { skin: 0, hair: 0, hairShape: 0, outfit: 0, hat: 0, accessory: 0 };

export function stillFrame(facing: Facing, appearance: Appearance = BASE_LOOK): Rgba {
  return paintPose(STILL[facing], appearance, facing);
}

export function walkFrames(facing: Facing, appearance: Appearance = BASE_LOOK): Rgba[] {
  return [0, 1, 2, 3, 4, 5].map((frame) => paintPose(walkMatrix(facing, frame), appearance, facing));
}

export function sitFrames(appearance: Appearance = BASE_LOOK): Rgba[] {
  return [0, 1, 2, 3].map((frame) => paintPose(typingMatrix(frame), appearance, 'north'));
}

export function leisureFrames(appearance: Appearance = BASE_LOOK): {
  campfire: Rgba[];
  woodpile: Rgba[];
  garden: Rgba[];
} {
  return {
    campfire: [0, 1, 2, 3].map((frame) => paintPose(campfireMatrix(frame), appearance, 'east')),
    woodpile: [0, 1, 2, 3].map((frame) => {
      const matrix = axeMatrix(frame);
      return paintPose(matrix, appearance, 'north', axeTools(frame));
    }),
    garden: [0, 1, 2].map((frame) => {
      const matrix = gardenMatrix(frame);
      return paintPose(matrix, appearance, 'south', gardenTools(frame));
    }),
  };
}

export function alphaMask(img: Rgba): string {
  let bits = '';
  for (let i = 3; i < img.data.length; i += 4) bits += img.data[i] === 0 ? '0' : '1';
  return bits;
}
