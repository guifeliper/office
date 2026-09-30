/**
 * The office world as data: terrain per 16×16 cell plus props placed on cells.
 * Layout follows `docs/design/cursor-office-map-sketch-v2.png`; nothing here reads that image.
 * Pure — the ground renderer, the nav grid, and the tests all read this module.
 */

export const TILE = 16;
export const COLS = 80;
export const ROWS = 45;

export type Terrain = 'void' | 'grass' | 'path' | 'sand' | 'water' | 'floor' | 'wall';

export type PropKind =
  | 'lodgeRoof'
  | 'meetingTable'
  | 'campfire'
  | 'stumpAxe'
  | 'woodpile'
  | 'gardenBed'
  | 'gateLeft'
  | 'gateRight'
  | 'gatehouse'
  | 'lodgeDoor'
  | 'fence'
  | 'tree'
  | 'rock'
  | 'bush'
  | 'shoreRock'
  | 'bridge'
  | 'mailbox'
  | 'lantern'
  | 'flower'
  | 'bloom'
  | 'mushroom'
  | 'banana'
  | 'cherry'
  | 'fruitTree'
  | 'lily'
  | 'doghouse'
  | 'laundry'
  | 'hay'
  | 'crate'
  | 'butterfly'
  | 'greenhouse'
  | 'canoe'
  | 'pier'
  | 'sandcastle'
  | 'waterfall';

/**
 * - `none`: base sprite only.
 * - `canopy`: top piece sorts by its own bottom line, so a walker south of it draws in front.
 * - `overhead`: top piece (lintel, roof) draws above every walker.
 */
export type ForegroundSort = 'none' | 'canopy' | 'overhead';

export interface PropSpec {
  /** Tiles wide. The sprite's bottom-center sits on the bottom edge of this span. */
  span: number;
  /** Solid cells relative to the placement's (col, row): dx in [0, span), dy <= 0. */
  blocks: readonly (readonly [number, number])[];
  foreground: ForegroundSort;
}

const row = (span: number, dy = 0): [number, number][] =>
  Array.from({ length: span }, (_, dx) => [dx, dy] as [number, number]);

export const PROP_SPECS: Record<PropKind, PropSpec> = {
  // Premade cottage sprite. It never blocks by itself; the shell does. Sorts by its base.
  lodgeRoof: { span: 4, blocks: [], foreground: 'none' },
  meetingTable: { span: 3, blocks: [...row(3), ...row(3, -1)], foreground: 'none' },
  campfire: { span: 1, blocks: row(1), foreground: 'none' },
  stumpAxe: { span: 1, blocks: row(1), foreground: 'none' },
  woodpile: { span: 1, blocks: row(1), foreground: 'none' },
  gardenBed: { span: 3, blocks: [...row(3), ...row(3, -1)], foreground: 'none' },
  gateLeft: { span: 1, blocks: row(1), foreground: 'none' },
  gateRight: { span: 1, blocks: row(1), foreground: 'none' },
  // Stone pillars are solid; the two middle cells are the passage.
  gatehouse: { span: 4, blocks: [[0, 0], [3, 0], [0, -1], [3, -1]], foreground: 'overhead' },
  // The door is the passage through the lodge's front wall.
  lodgeDoor: { span: 2, blocks: [], foreground: 'none' },
  fence: { span: 2, blocks: row(2), foreground: 'none' },
  // Trunk is solid; the canopy never blocks.
  tree: { span: 1, blocks: row(1), foreground: 'canopy' },
  rock: { span: 2, blocks: row(2), foreground: 'none' },
  // Knee-high volume: walkers pass through, so it never blocks.
  bush: { span: 1, blocks: [], foreground: 'none' },
  shoreRock: { span: 1, blocks: row(1), foreground: 'none' },
  /** Deck sits on the pond's south shore. The span is solid so the path goes around it. */
  bridge: { span: 5, blocks: row(5), foreground: 'none' },
  mailbox: { span: 1, blocks: row(1), foreground: 'none' },
  lantern: { span: 1, blocks: row(1), foreground: 'none' },
  flower: { span: 1, blocks: [], foreground: 'none' },
  bloom: { span: 1, blocks: [], foreground: 'none' },
  mushroom: { span: 1, blocks: [], foreground: 'none' },
  banana: { span: 1, blocks: row(1), foreground: 'none' },
  cherry: { span: 2, blocks: row(1), foreground: 'none' },
  fruitTree: { span: 2, blocks: row(1), foreground: 'none' },
  lily: { span: 1, blocks: [], foreground: 'none' },
  doghouse: { span: 2, blocks: row(2), foreground: 'none' },
  laundry: { span: 2, blocks: [], foreground: 'none' },
  hay: { span: 2, blocks: row(2), foreground: 'none' },
  crate: { span: 1, blocks: row(1), foreground: 'none' },
  butterfly: { span: 1, blocks: [], foreground: 'none' },
  greenhouse: { span: 4, blocks: [...row(4), ...row(4, -1)], foreground: 'none' },
  canoe: { span: 2, blocks: [], foreground: 'none' },
  pier: { span: 8, blocks: [], foreground: 'none' },
  sandcastle: { span: 1, blocks: row(1), foreground: 'none' },
  waterfall: { span: 4, blocks: [], foreground: 'none' },
};

/**
 * Height of the trunk sprite above the feet. The maple crop keeps the lower
 * boughs in this strip so the line still meets the canopy.
 */
export const TRUNK_HEIGHT = 18;

/** Campfire heart. The warm pool is Chebyshev ≤ 2 from here, so it stays a puddle. */
export const CAMPFIRE_CELL = { col: 30, row: 13 } as const;

export function inCampfireGlow(col: number, rowIndex: number): boolean {
  return Math.max(Math.abs(col - CAMPFIRE_CELL.col), Math.abs(rowIndex - CAMPFIRE_CELL.row)) <= 2;
}

export interface PropPlacement {
  kind: PropKind;
  col: number;
  row: number;
}

export interface Cell {
  col: number;
  row: number;
}

/** Island in the ocean. The coast radius wobbles, and the north shore stays below row 5. */
const ISLAND = { cx: 40, cy: 22, rx: 31, ry: 16 } as const;
const POND = { cx: 40, cy: 12, rx: 6, ry: 2.2 } as const;

/**
 * Cottage footprint. The sprite is the premade house; this box is the solid shell.
 * The door cell is the step. Cabana Norte stays the 24×18 interior.
 */
export const LODGE = { left: 38, right: 41, top: 17, bottom: 21, doorCols: [40] } as const;

/** Sand paths: south gate to the house, then west to the garden, northwest to the fire, north to the pond. */
const PATHS: readonly (readonly [number, number, number, number])[] = [
  [40, 40, 37, 33],
  [37, 33, 43, 27],
  [43, 27, 40, 22],
  [40, 25, 30, 23],
  [30, 23, 22, 26],
  [36, 20, 30, 16],
  [30, 16, 28, 13],
  [38, 18, 34, 14],
  [34, 14, 40, 12],
];
const PLAZA = { cx: 40, cy: 25, r: 2.4 } as const;

/** 1.0 sits on the base ellipse. The north factor keeps row 5 in the ocean. Lobes keep the coast irregular. */
function coastScale(angle: number): number {
  const scale = 0.9
    + 0.16 * Math.sin(angle * 2 + 0.4)
    + 0.11 * Math.sin(angle * 3 + 1.2)
    + 0.07 * Math.cos(angle * 5 + 0.6);
  return Math.sin(angle) < 0 ? scale * 0.8 : scale;
}

function inIslandEllipse(col: number, rowIndex: number): boolean {
  const dx = (col + 0.5 - ISLAND.cx) / ISLAND.rx;
  const dy = (rowIndex + 0.5 - ISLAND.cy) / ISLAND.ry;
  const dist = Math.hypot(dx, dy);
  return dist <= coastScale(Math.atan2(dy, dx));
}

/** Coast features laid over the ellipse, so the outline reads as an island, not a lozenge. */
const PENINSULAS: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 73, cy: 23.5, rx: 5, ry: 1.6 },
  { cx: 14, cy: 33, rx: 4.5, ry: 1.5 },
];
const BAYS: readonly { cx: number; cy: number; r: number }[] = [
  { cx: 15.5, cy: 24.5, r: 1.8 },
  { cx: 63, cy: 19.5, r: 2.4 },
  { cx: 60, cy: 31.5, r: 2.4 },
];
/** Top-left cell of each 3×2 islet. Each carries one pack stone. */
export const ISLETS: readonly Cell[] = [
  { col: 8, row: 19 },
  { col: 6, row: 28 },
  { col: 70, row: 14 },
  { col: 67, row: 35 },
  { col: 23, row: 37 },
];

function inCoastFeature(col: number, rowIndex: number): boolean | null {
  const x = col + 0.5;
  const y = rowIndex + 0.5;
  if (BAYS.some((b) => Math.hypot(x - b.cx, y - b.cy) <= b.r)) return false;
  if (PENINSULAS.some((p) => ((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 <= 1)) return true;
  if (ISLETS.some((i) => col >= i.col && col <= i.col + 2 && rowIndex >= i.row && rowIndex <= i.row + 1)) return true;
  return null;
}

/**
 * The ellipse, then two smooth passes. A lone land cell becomes ocean.
 * A water cell with three land sides becomes land. That keeps the cliff
 * from breaking into one-cell peninsulas.
 */
const LAND_MASK = (() => {
  const grid = new Uint8Array(COLS * ROWS);
  const land = (c: number, r: number, src: Uint8Array) =>
    c >= 0 && r >= 0 && c < COLS && r < ROWS && src[r * COLS + c] === 1;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const feature = inCoastFeature(c, r);
      const land = feature ?? inIslandEllipse(c, r);
      if (land && !inPond(c, r)) grid[r * COLS + c] = 1;
    }
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const next = grid.slice();
    for (let r = 1; r < ROWS - 1; r += 1) {
      for (let c = 1; c < COLS - 1; c += 1) {
        if (inPond(c, r) || inCoastFeature(c, r) === false) {
          next[r * COLS + c] = 0;
          continue;
        }
        const neighbors =
          (land(c, r - 1, grid) ? 1 : 0) +
          (land(c, r + 1, grid) ? 1 : 0) +
          (land(c - 1, r, grid) ? 1 : 0) +
          (land(c + 1, r, grid) ? 1 : 0);
        const index = r * COLS + c;
        if (grid[index] === 1 && neighbors <= 1) next[index] = 0;
        else if (grid[index] === 0 && neighbors >= 3) next[index] = 1;
      }
    }
    grid.set(next);
  }
  return grid;
})();

function inIsland(col: number, rowIndex: number): boolean {
  if (col < 0 || rowIndex < 0 || col >= COLS || rowIndex >= ROWS) return false;
  return LAND_MASK[rowIndex * COLS + col] === 1;
}

/**
 * Raised grass. The ledge autotile is drawn where these meet the field,
 * with the lower grass as the base layer under the hole.
 */
const TERRACES: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 26, cy: 15, rx: 8, ry: 4.2 },
  { cx: 56, cy: 24, rx: 7.5, ry: 4 },
  { cx: 22, cy: 28, rx: 6, ry: 3.2 },
];

function inTerrace(col: number, rowIndex: number): boolean {
  if (!inIsland(col, rowIndex) || onPath(col, rowIndex) || inBeach(col, rowIndex) || inPond(col, rowIndex)) return false;
  if (col >= LODGE.left - 1 && col <= LODGE.right + 1 && rowIndex >= LODGE.top - 1 && rowIndex <= LODGE.bottom + 1) return false;
  return TERRACES.some((blob) => {
    const dx = (col + 0.5 - blob.cx) / blob.rx;
    const dy = (rowIndex + 0.5 - blob.cy) / blob.ry;
    return dx * dx + dy * dy <= 1;
  });
}

/** 0 ocean and pond, 1 the field, 2 a raised grass ledge. */
export function elevationAt(col: number, rowIndex: number): 0 | 1 | 2 {
  if (!inIsland(col, rowIndex) || inPond(col, rowIndex)) return 0;
  return inTerrace(col, rowIndex) ? 2 : 1;
}

/**
 * South face of the north plateau. The cliff sheet only opens south, so this is
 * the one place it is used. The ocean coast stays a grass bank.
 */
const NORTH_FACE = { row: 14, left: 30, right: 52, gapLeft: 36, gapRight: 39 } as const;

function inNorthPool(col: number, rowIndex: number): boolean {
  if (rowIndex < NORTH_FACE.row || rowIndex > NORTH_FACE.row + 2) return false;
  if (col < NORTH_FACE.left || col > NORTH_FACE.right) return false;
  if (!inIsland(col, rowIndex)) return false;
  if (col >= LODGE.left && col <= LODGE.right && rowIndex >= LODGE.top) return false;
  return true;
}

/**
 * Water directly under the plateau grass. The gap is the waterfall.
 * A coast that is not this row does not get a cliff.
 */
export function cliffCapAt(col: number, rowIndex: number): boolean {
  if (rowIndex !== NORTH_FACE.row) return false;
  if (col < NORTH_FACE.left || col > NORTH_FACE.right) return false;
  if (col >= NORTH_FACE.gapLeft && col <= NORTH_FACE.gapRight) return false;
  if (!inNorthPool(col, rowIndex)) return false;
  const north = terrainAt(col, rowIndex - 1);
  return north === 'grass' || north === 'path';
}

/** A cliff cap that sits in a run of at least four columns, so the rock reads as a wall. */
export function cliffRunAt(col: number, rowIndex: number): boolean {
  if (!cliffCapAt(col, rowIndex)) return false;
  let run = 1;
  for (let c = col - 1; cliffCapAt(c, rowIndex); c -= 1) run += 1;
  for (let c = col + 1; cliffCapAt(c, rowIndex); c += 1) run += 1;
  return run >= 4;
}

function inPond(col: number, rowIndex: number): boolean {
  const lobe = (cx: number, cy: number, rx: number, ry: number) => {
    const dx = (col + 0.5 - cx) / rx;
    const dy = (rowIndex + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
  return lobe(POND.cx, POND.cy, POND.rx, POND.ry) || lobe(35, 11, 3.2, 1.8);
}

const PATH_HALF_WIDTH = 1;

/** Cells from a cell center to the nearest path centerline; the plaza counts as its rim. */
export function pathDistance(col: number, rowIndex: number): number {
  const px = col + 0.5;
  const py = rowIndex + 0.5;
  let best = Math.max(0, Math.hypot(px - PLAZA.cx, py - PLAZA.cy) - PLAZA.r + PATH_HALF_WIDTH);
  for (const [x0, y0, x1, y1] of PATHS) {
    const vx = x1 - x0;
    const vy = y1 - y0;
    const len2 = vx * vx + vy * vy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / len2));
    best = Math.min(best, Math.hypot(px - (x0 + t * vx), py - (y0 + t * vy)));
  }
  return best;
}

function onPath(col: number, rowIndex: number): boolean {
  if (rowIndex === LODGE.bottom && col === LODGE.doorCols[0]) return true;
  const d = pathDistance(col, rowIndex);
  if (d <= 0.65) return true;
  if (d > PATH_HALF_WIDTH) return false;
  return cellHash(col, rowIndex) % 2 === 0;
}

/**
 * The yard lodge is a closed shell the size of the cottage. The room lives in the cabin.
 * Only the door step stays walkable, as the portal.
 */
export function lodgeShellSolid(col: number, rowIndex: number): boolean {
  const { left, right, top, bottom, doorCols } = LODGE;
  if (col < left || col > right || rowIndex < top || rowIndex > bottom) return false;
  return !(rowIndex === bottom && (doorCols as readonly number[]).includes(col));
}

/**
 * South cove. Deeper in the middle, a thin sand lip at the sides, so the beach is not a rectangle.
 */
function inBeach(col: number, rowIndex: number): boolean {
  if (!inIsland(col, rowIndex) || rowIndex < ISLAND.cy + 6) return false;
  const along = Math.abs(col - 40);
  if (along > 8) return false;
  const edge = southEdge(col);
  if (edge < 0) return false;
  const depth = 2 + Math.round(2 * (1 - along / 8));
  return rowIndex >= edge - depth;
}

export function terrainAt(col: number, rowIndex: number): Terrain {
  if (col < 0 || rowIndex < 0 || col >= COLS || rowIndex >= ROWS) return 'void';
  if (!inIsland(col, rowIndex)) return 'water';
  if (inNorthPool(col, rowIndex)) return 'water';
  if (inPond(col, rowIndex)) return 'water';
  if (onPath(col, rowIndex)) return 'path';
  if (inBeach(col, rowIndex)) return 'sand';
  return 'grass';
}

/** Last island row in a column — where the south fence runs. */
function southEdge(col: number): number {
  for (let r = ROWS - 1; r >= 0; r -= 1) if (inIsland(col, r)) return r;
  return -1;
}

/** Gate passage cells in the south fence. Consultants spawn here. */
export const GATE_COLS = [39, 40] as const;
export const GATE_ROW = southEdge(40);


/** Stable per-cell hash. Ground tiles and scatter props pick variants from it. */
export function cellHash(c: number, r: number): number {
  let h = (c * 73856093) ^ (r * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Which canopy PNG a trunk wears. Same cell, same tree. */
export function canopyVariant(col: number, row: number): number {
  return cellHash(col, row) % 3;
}

/** Which bush PNG. Same cell, same bush. */
export function bushVariant(col: number, row: number): number {
  return cellHash(col, row) % 2;
}

const BASE_TREES: readonly Cell[] = [
  { col: 30, row: 12 }, { col: 50, row: 12 }, { col: 24, row: 16 }, { col: 56, row: 18 },
  { col: 22, row: 24 }, { col: 54, row: 26 }, { col: 28, row: 30 }, { col: 48, row: 28 },
  { col: 34, row: 11 }, { col: 46, row: 15 },
].filter((cell) => terrainAt(cell.col, cell.row) === 'grass');

const ROCKS: readonly Cell[] = [
  { col: 26, row: 11 }, { col: 52, row: 14 }, { col: 20, row: 28 }, { col: 54, row: 30 },
  { col: 32, row: 31 }, { col: 46, row: 32 },
].filter((cell) => terrainAt(cell.col, cell.row) === 'grass');

/** Placements that are laid out by hand; scatter props must keep clear of their cells. */
const FIXED: readonly PropPlacement[] = [
  { kind: 'meetingTable', col: 24, row: 18 },
  { kind: 'campfire', col: CAMPFIRE_CELL.col, row: CAMPFIRE_CELL.row },
  { kind: 'stumpAxe', col: 26, row: 14 },
  { kind: 'woodpile', col: 28, row: 15 },
  { kind: 'gardenBed', col: 20, row: 22 },
  { kind: 'gardenBed', col: 24, row: 22 },
  { kind: 'gardenBed', col: 20, row: 26 },
  { kind: 'gardenBed', col: 24, row: 26 },
  { kind: 'greenhouse', col: 15, row: 28 },
  { kind: 'doghouse', col: 22, row: 16 },
  { kind: 'laundry', col: 33, row: 17 },
  { kind: 'hay', col: 24, row: 17 },
  { kind: 'crate', col: 36, row: 18 },
  { kind: 'cherry', col: 48, row: 16 },
  { kind: 'cherry', col: 16, row: 18 },
  { kind: 'banana', col: 14, row: 30 },
  { kind: 'banana', col: 58, row: 22 },
  { kind: 'fruitTree', col: 46, row: 26 },
  { kind: 'fruitTree', col: 48, row: 24 },
  { kind: 'fruitTree', col: 18, row: 12 },
  { kind: 'fruitTree', col: 20, row: 14 },
  { kind: 'cherry', col: 50, row: 18 },
  { kind: 'cherry', col: 52, row: 20 },
  { kind: 'gatehouse', col: 38, row: GATE_ROW - 3 },
  { kind: 'mailbox', col: 42, row: LODGE.bottom },
  { kind: 'waterfall', col: 36, row: 16 },
  { kind: 'lily', col: 34, row: 12 },
  { kind: 'lily', col: 38, row: 13 },
  { kind: 'lily', col: 43, row: 12 },
  { kind: 'lily', col: 47, row: 12 },
  { kind: 'lily', col: 41, row: 11 },
  { kind: 'canoe', col: 32, row: GATE_ROW + 1 },
  { kind: 'pier', col: 48, row: GATE_ROW + 1 },
  { kind: 'sandcastle', col: 33, row: 35 },
  { kind: 'fence', col: 16, row: 20 },
  { kind: 'fence', col: 18, row: 20 },
  { kind: 'fence', col: 20, row: 20 },
  { kind: 'fence', col: 22, row: 20 },
  { kind: 'fence', col: 24, row: 20 },
  { kind: 'fence', col: 26, row: 20 },
  { kind: 'fence', col: 16, row: 30 },
  { kind: 'fence', col: 20, row: 30 },
  { kind: 'fence', col: 24, row: 30 },
  { kind: 'fence', col: 34, row: 16 },
  { kind: 'fence', col: 36, row: 16 },
  { kind: 'fence', col: 42, row: 16 },
  { kind: 'fence', col: 44, row: 16 },
  { kind: 'fence', col: 34, row: 23 },
  { kind: 'fence', col: 36, row: 23 },
  { kind: 'fence', col: 44, row: 23 },
  { kind: 'gateLeft', col: 38, row: GATE_ROW },
  { kind: 'gateRight', col: 41, row: GATE_ROW },
  ...ROCKS.map((cell) => ({ kind: 'rock' as const, ...cell })),
  ...ISLETS.map((cell) => ({ kind: 'rock' as const, col: cell.col, row: cell.row + 1 })),
];

/** Cells the fixed props cover, grown by one cell so scatter never touches them. */
const FIXED_CLEARANCE: ReadonlySet<string> = (() => {
  const out = new Set<string>();
  for (const p of FIXED) {
    const { span } = PROP_SPECS[p.kind];
    for (let dx = -1; dx <= span; dx += 1) {
      for (let dy = -2; dy <= 1; dy += 1) out.add(`${p.col + dx},${p.row + dy}`);
    }
  }
  return out;
})();

/** Leisure standing cells (see landmarks.ts). Scatter keeps off them. */
const LEISURE_CELLS: readonly Cell[] = [
  { col: 26, row: 15 }, { col: 28, row: 16 },
  { col: 23, row: 24 }, { col: 23, row: 25 }, { col: 23, row: 28 },
];

/** Arrival line: the south path, cols 37–43, from the house down to the gate. */
function inGateCorridor(col: number, rowIndex: number): boolean {
  return col >= 37 && col <= 43 && rowIndex >= LODGE.bottom && rowIndex <= GATE_ROW;
}

function scatterOk(col: number, rowIndex: number): boolean {
  if (lodgeShellSolid(col, rowIndex)) return false;
  if (terrainAt(col, rowIndex) !== 'grass' && terrainAt(col, rowIndex) !== 'sand') return false;
  if (FIXED_CLEARANCE.has(`${col},${rowIndex}`)) return false;
  if (inGateCorridor(col, rowIndex)) return false;
  return !LEISURE_CELLS.some((c) => Math.abs(c.col - col) <= 1 && Math.abs(c.row - rowIndex) <= 1);
}

const chebyshev = (a: Cell, b: Cell) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

const TREE_TARGET = 28;

/** A canopy is ~3 tiles wide: keep it off the lodge and two cells clear of hand-placed props. */
function treeRoom(cell: Cell): boolean {
  const { left, right, top, bottom } = LODGE;
  if (cell.col >= left - 3 && cell.col <= right + 3 && cell.row >= top - 2 && cell.row <= bottom + 3) return false;
  return !FIXED.some((p) => blockedCells(p).some((b) => chebyshev(b, cell) <= 2));
}

/**
 * Rim trees: the island ellipse sampled about every 4 tiles of arc, first at 0.92 of its
 * radius, then on inner rings until the target count, so the field edge reads as woods.
 */
function rimTrees(existing: readonly Cell[]): Cell[] {
  const out: Cell[] = [];
  const all = [...existing];
  for (const ring of [0.72, 0.58, 0.46, 0.34]) {
    const samples = Math.round(56 * ring);
    for (let i = 0; i < samples && all.length < TREE_TARGET; i += 1) {
      const a = (i / samples) * Math.PI * 2;
      const cell = {
        col: Math.round(ISLAND.cx + ring * ISLAND.rx * Math.cos(a) - 0.5),
        row: Math.round(ISLAND.cy + ring * ISLAND.ry * Math.sin(a) - 0.5),
      };
      tryTree(cell, all, out);
    }
  }
  for (let row = 0; row < ROWS && all.length < TREE_TARGET; row += 2) {
    for (let col = 0; col < COLS && all.length < TREE_TARGET; col += 2) {
      tryTree({ col, row }, all, out);
    }
  }
  return out;
}

function tryTree(cell: Cell, all: Cell[], out: Cell[]): void {
  if (all.length >= TREE_TARGET) return;
  if (cell.row > ISLAND.cy + 8 && Math.abs(cell.col - 40) < 8) return;
  if (cell.col >= 26 && cell.col <= 34 && cell.row >= 11 && cell.row <= 16) return;
  if (terrainAt(cell.col, cell.row) !== 'grass' || !scatterOk(cell.col, cell.row) || !treeRoom(cell)) return;
  if (pathDistance(cell.col, cell.row) <= 2.2) return;
  if (all.some((t) => chebyshev(t, cell) < 3)) return;
  all.push(cell);
  out.push(cell);
}

export const TREES: readonly Cell[] = [...BASE_TREES, ...rimTrees(BASE_TREES)];

const GARDEN = { left: 18, right: 28, top: 20, bottom: 30 } as const;

function inGarden(col: number, rowIndex: number): boolean {
  return col >= GARDEN.left && col <= GARDEN.right && rowIndex >= GARDEN.top && rowIndex <= GARDEN.bottom;
}

const BUSH_CAP = 30;
const BUSH_GAP_CAP = 42;
const RIM_BUSHES = 12;

function touchesWater(col: number, rowIndex: number): boolean {
  return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dc, dr]) => terrainAt(col + dc!, rowIndex + dr!) === 'water');
}

/** Twelve bushes on the island step. The rest stay in the west and southeast gaps. */
function bushes(): Cell[] {
  const rim: Cell[] = [];
  for (let r = 0; r < ROWS && rim.length < RIM_BUSHES; r += 1) {
    for (let c = 0; c < COLS && rim.length < RIM_BUSHES; c += 1) {
      if (terrainAt(c, r) !== 'grass' || !touchesWater(c, r) || !scatterOk(c, r)) continue;
      if (TREES.some((t) => chebyshev(t, { col: c, row: r }) <= 1)) continue;
      if (r > ISLAND.cy + 8 && Math.abs(c - 40) < 8) continue;
      if (pathDistance(c, r) <= 2.2) continue;
      if (rim.some((b) => chebyshev(b, { col: c, row: r }) < 2)) continue;
      rim.push({ col: c, row: r });
    }
  }
  const out = [...rim];
  for (let r = 0; r < ROWS && out.length < BUSH_CAP; r += 1) {
    for (let c = 0; c < COLS && out.length < BUSH_CAP; c += 1) {
      if (cellHash(c, r) % 2 !== 0) continue;
      if (terrainAt(c, r) !== 'grass' || !scatterOk(c, r) || inGarden(c, r) || touchesWater(c, r)) continue;
      if (pathDistance(c, r) <= 2.2) continue;
      if (TREES.some((t) => chebyshev(t, { col: c, row: r }) <= 1)) continue;
      if (out.some((b) => chebyshev(b, { col: c, row: r }) < 2)) continue;
      out.push({ col: c, row: r });
    }
  }
  for (let r = 4; r < ROWS - 4 && out.length < BUSH_GAP_CAP; r += 1) {
    for (let c = 4; c < COLS - 4 && out.length < BUSH_GAP_CAP; c += 1) {
      if (!gapClear(c, r, out)) continue;
      out.push({ col: c, row: r });
    }
  }
  return out;
}

function gapClear(col: number, rowIndex: number, placed: readonly Cell[]): boolean {
  if (!scatterOk(col, rowIndex) || inGarden(col, rowIndex)) return false;
  if (pathDistance(col, rowIndex) <= 2.2) return false;
  if (TREES.some((t) => chebyshev(t, { col, row: rowIndex }) <= 2)) return false;
  if (placed.some((b) => chebyshev(b, { col, row: rowIndex }) < 5)) return false;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (terrainAt(col + dc, rowIndex + dr) !== 'grass') return false;
      if (TREES.some((t) => t.col === col + dc && t.row === rowIndex + dr)) return false;
      if (placed.some((b) => b.col === col + dc && b.row === rowIndex + dr)) return false;
    }
  }
  return true;
}

export const BUSHES: readonly Cell[] = bushes();

/**
 * Posts just off the sand, so the arrival line (gate → lodge door) stays open.
 * Each cell is checked against the path half-width when the layout is built.
 */
const LANTERNS: readonly Cell[] = [
  { col: 36, row: 28 },
  { col: 44, row: 28 },
  { col: 36, row: 33 },
  { col: 44, row: 32 },
  { col: 30, row: 18 },
].filter((c) => terrainAt(c.col, c.row) === 'grass' && pathDistance(c.col, c.row) > 1.5 && !BUSHES.some((b) => b.col === c.col && b.row === c.row));

const SHORE_ROCK_CAP = 22;

function shoreRocks(): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < ROWS && out.length < SHORE_ROCK_CAP; r += 1) {
    for (let c = 0; c < COLS && out.length < SHORE_ROCK_CAP; c += 1) {
      if (terrainAt(c, r) !== 'grass' || !touchesWater(c, r)) continue;
      if (c >= 37 && c <= 40) continue;
      if (cellHash(c, r) % 3 !== 0) continue;
      if (TREES.some((t) => t.col === c && t.row === r)) continue;
      if (BUSHES.some((b) => b.col === c && b.row === r)) continue;
      out.push({ col: c, row: r });
    }
  }
  return out;
}

export const SHORE_ROCKS: readonly Cell[] = shoreRocks();

/** Cottage sprite. Bottom-center sits on the door row, so the step lands on the portal cell. */
export const LODGE_ROOF: PropPlacement = { kind: 'lodgeRoof', col: LODGE.left, row: LODGE.bottom };

/** Opaque size of `lodge-house.png`, the tight crop of Houses/10.png. */
const LODGE_SPRITE = { w: 72, h: 95 } as const;

const DECOR_KINDS = ['flower', 'mushroom', 'bloom', 'butterfly'] as const;

/** Several small sprites in every 5×5 of open grass or sand, spread across the block. */
function decorations(): PropPlacement[] {
  const taken = new Set<string>();
  const mark = (col: number, row: number) => taken.add(`${col},${row}`);
  for (const p of [...FIXED, LODGE_ROOF]) {
    mark(p.col, p.row);
    mark(p.col + 1, p.row);
  }
  for (const t of TREES) mark(t.col, t.row);
  for (const b of BUSHES) mark(b.col, b.row);
  for (const r of SHORE_ROCKS) mark(r.col, r.row);
  const out: PropPlacement[] = [];
  for (let br = 0; br < ROWS; br += 5) {
    for (let bc = 0; bc < COLS; bc += 5) {
      const spots: Cell[] = [];
      for (let r = br; r < br + 5 && r < ROWS; r += 1) {
        for (let c = bc; c < bc + 5 && c < COLS; c += 1) {
          if (taken.has(`${c},${r}`)) continue;
          const ground = terrainAt(c, r);
          if (ground !== 'grass' && ground !== 'sand') continue;
          if (!scatterOk(c, r)) continue;
          spots.push({ col: c, row: r });
        }
      }
      const want = Math.min(3, spots.length);
      for (let i = 0; i < want; i += 1) {
        const cell = spots[Math.floor((i * spots.length) / want)]!;
        if (taken.has(`${cell.col},${cell.row}`)) continue;
        out.push({
          kind: DECOR_KINDS[(cellHash(cell.col, cell.row) + i) % DECOR_KINDS.length]!,
          col: cell.col,
          row: cell.row,
        });
        taken.add(`${cell.col},${cell.row}`);
      }
    }
  }
  return out;
}

export const PROPS: readonly PropPlacement[] = [
  ...FIXED,
  LODGE_ROOF,
  ...TREES.map((cell) => ({ kind: 'tree' as const, ...cell })),
  ...BUSHES.map((cell) => ({ kind: 'bush' as const, ...cell })),
  ...SHORE_ROCKS.map((cell) => ({ kind: 'shoreRock' as const, ...cell })),
  ...LANTERNS.map((cell) => ({ kind: 'lantern' as const, ...cell })),
  ...decorations(),
];

/** Solid cells a placement occupies. */
export function blockedCells(placement: PropPlacement): Cell[] {
  return PROP_SPECS[placement.kind].blocks.map(([dx, dy]) => ({
    col: placement.col + dx,
    row: placement.row + dy,
  }));
}

/** World point where the prop's base (feet) sits: bottom-center of its span. */
export function propBase(placement: PropPlacement): { x: number; y: number } {
  const { span } = PROP_SPECS[placement.kind];
  return { x: (placement.col + span / 2) * TILE, y: (placement.row + 1) * TILE };
}

/** World Y of a canopy's last opaque row. Walkers with feet below this line draw in front of it. */
export function canopyLineY(placement: PropPlacement): number {
  return propBase(placement).y - TRUNK_HEIGHT - 1;
}

export function cellCenter(cell: Cell): { x: number; y: number } {
  return { x: cell.col * TILE + TILE / 2, y: cell.row * TILE + TILE / 2 };
}

/** Yard click target for entering the cabin: the cottage sprite, in yard world pixels. */
export function lodgeRect(): { x: number; y: number; w: number; h: number } {
  const { x, y } = propBase(LODGE_ROOF);
  return {
    x: Math.round(x) - Math.floor(LODGE_SPRITE.w / 2),
    y: y - LODGE_SPRITE.h,
    w: LODGE_SPRITE.w,
    h: LODGE_SPRITE.h,
  };
}

export function cellAt(x: number, y: number): Cell {
  return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
}
