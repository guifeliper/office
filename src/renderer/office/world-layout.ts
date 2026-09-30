/**
 * The office world as data: terrain per 16×16 cell plus props placed on cells.
 * Fixed paths, zones, and fixed props load from `yard-map.yaml`.
 * Autotiles, scatter decorations, collision (`PROP_SPECS`), and nav stay here.
 * Layout follows `docs/design/cursor-office-map-sketch-v2.png`; nothing here reads that image.
 */
import { LEISURE_DEFS } from './leisure';
import yardMapSource from './yard-map.yaml?raw';
import { parseYardMap, type YardMap, type YardPropRow } from './yard-map';

export const TILE = 16;
export const COLS = 64;
export const ROWS = 64;

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
  | 'waterfall'
  | 'fishman'
  | 'pine'
  | 'palm'
  | 'bench'
  | 'stall'
  | 'barrel'
  | 'starfish'
  | 'reed';

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
  fence: { span: 3, blocks: row(3), foreground: 'none' },
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
  pier: { span: 3, blocks: [], foreground: 'none' },
  sandcastle: { span: 1, blocks: row(1), foreground: 'none' },
  waterfall: { span: 4, blocks: [], foreground: 'none' },
  /** Left half of Fishman house.png. Five tiles wide, solid so the pier path goes around it. */
  fishman: { span: 5, blocks: [...row(5), ...row(5, -1), ...row(5, -2)], foreground: 'none' },
  /** Small summer pine. The sheet's large pines are snow or dead. */
  pine: { span: 1, blocks: row(1), foreground: 'none' },
  /** One palm cut from the hammock pair. */
  palm: { span: 5, blocks: row(1), foreground: 'none' },
  bench: { span: 2, blocks: row(2), foreground: 'none' },
  /** Vendor stand. The striped market stall is not in the pack. */
  stall: { span: 2, blocks: [...row(2), ...row(2, -1)], foreground: 'none' },
  barrel: { span: 1, blocks: row(1), foreground: 'none' },
  starfish: { span: 1, blocks: [], foreground: 'none' },
  reed: { span: 1, blocks: [], foreground: 'none' },
};

/** Checked-in yard contract. Collision and scatter do not read this for their rules. */
export const YARD_MAP: YardMap = parseYardMap(yardMapSource, Object.keys(PROP_SPECS));

/**
 * Height of the trunk sprite above the feet. The maple crop keeps the lower
 * boughs in this strip so the line still meets the canopy.
 */
export const TRUNK_HEIGHT = 18;

/** Campfire heart. The warm pool is Chebyshev ≤ 2 from here, so it stays a puddle. */
export const CAMPFIRE_CELL = (() => {
  const fire = YARD_MAP.props.find((prop) => prop.kind === 'campfire');
  if (!fire || typeof fire.row !== 'number') throw new Error('yard-map: campfire needs a numeric cell');
  return { col: fire.col, row: fire.row } as const;
})();

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

/** Round island. Water stays on every side; the old 80×45 frame had flattened this into a strip. */
const ISLAND = YARD_MAP.island;

/**
 * Cottage footprint. The sprite is the premade house; this box is the solid shell.
 * The door cell is the step. Cabana Norte stays the 24×18 interior.
 */
export const LODGE = YARD_MAP.lodge;

/** Sand paths: south beach to the house, west to the garden, northwest to the fire, east to the fishman. */
const PATHS = YARD_MAP.paths;
const PLAZA = YARD_MAP.plaza;

/** A little wobble so the coast is an oval, not a stamp. No north squash: that made the strip. */
function coastScale(angle: number): number {
  return 0.96
    + 0.07 * Math.sin(angle * 3 + 0.5)
    + 0.04 * Math.cos(angle * 5 + 0.2);
}

function inIslandEllipse(col: number, rowIndex: number): boolean {
  const dx = (col + 0.5 - ISLAND.cx) / ISLAND.rx;
  const dy = (rowIndex + 0.5 - ISLAND.cy) / ISLAND.ry;
  const dist = Math.hypot(dx, dy);
  return dist <= coastScale(Math.atan2(dy, dx));
}

/** Coast features laid over the ellipse, so the outline reads as an island, not a lozenge. */
const PENINSULAS = YARD_MAP.peninsulas;
const BAYS = YARD_MAP.bays;
/** Top-left cell of each corner islet. Spans vary so the pads are not one stamp. */
export const ISLETS: readonly Cell[] = YARD_MAP.islets;
const ISLET_SPAN: readonly { w: number; h: number }[] = [
  { w: 2, h: 2 },
  { w: 3, h: 1 },
  { w: 2, h: 2 },
  { w: 4, h: 2 },
  { w: 2, h: 1 },
];

function inCoastFeature(col: number, rowIndex: number): boolean | null {
  const x = col + 0.5;
  const y = rowIndex + 0.5;
  if (BAYS.some((b) => Math.hypot(x - b.cx, y - b.cy) <= b.r)) return false;
  if (PENINSULAS.some((p) => ((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 <= 1)) return true;
  if (ISLETS.some((islet, index) => {
    const span = ISLET_SPAN[index] ?? { w: 2, h: 2 };
    return col >= islet.col && col < islet.col + span.w && rowIndex >= islet.row && rowIndex < islet.row + span.h;
  })) return true;
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
      if (land) grid[r * COLS + c] = 1;
    }
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const next = grid.slice();
    for (let r = 1; r < ROWS - 1; r += 1) {
      for (let c = 1; c < COLS - 1; c += 1) {
        if (inCoastFeature(c, r) === false) {
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
  const seen = new Uint8Array(COLS * ROWS);
  const stack: number[] = [ISLAND.cy * COLS + ISLAND.cx];
  while (stack.length > 0) {
    const index = stack.pop()!;
    if (seen[index] || grid[index] !== 1) continue;
    seen[index] = 1;
    const c = index % COLS;
    const r = Math.floor(index / COLS);
    if (c > 0) stack.push(index - 1);
    if (c < COLS - 1) stack.push(index + 1);
    if (r > 0) stack.push(index - COLS);
    if (r < ROWS - 1) stack.push(index + COLS);
  }
  for (let index = 0; index < grid.length; index += 1) {
    if (grid[index] !== 1 || seen[index]) continue;
    const c = index % COLS;
    const r = Math.floor(index / COLS);
    const kept = ISLETS.some((islet, isletIndex) => {
      const span = ISLET_SPAN[isletIndex] ?? { w: 2, h: 2 };
      return c >= islet.col && c < islet.col + span.w && r >= islet.row && r < islet.row + span.h;
    });
    if (!kept) grid[index] = 0;
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
const TERRACES = YARD_MAP.terraces;

function inTerrace(col: number, rowIndex: number): boolean {
  if (!inIsland(col, rowIndex) || onPath(col, rowIndex) || inBeach(col, rowIndex)) return false;
  if (col >= LODGE.left - 1 && col <= LODGE.right + 1 && rowIndex >= LODGE.top - 1 && rowIndex <= LODGE.bottom + 1) return false;
  return TERRACES.some((blob) => {
    const dx = (col + 0.5 - blob.cx) / blob.rx;
    const dy = (rowIndex + 0.5 - blob.cy) / blob.ry;
    return dx * dx + dy * dy <= 1;
  });
}

/** 0 ocean and pond, 1 the field, 2 a raised grass ledge. */
export function elevationAt(col: number, rowIndex: number): 0 | 1 | 2 {
  if (!inIsland(col, rowIndex)) return 0;
  return inTerrace(col, rowIndex) ? 2 : 1;
}

/**
 * South face of the north plateau. The cliff sheet only opens south, so this is
 * the one place it is used. The ocean coast stays a grass bank.
 */
const NORTH_FACE = YARD_MAP.northFace;

function inNorthPool(col: number, rowIndex: number): boolean {
  if (rowIndex < NORTH_FACE.row || rowIndex > NORTH_FACE.row + 4) return false;
  if (!inIsland(col, rowIndex)) return false;
  if (col >= LODGE.left && col <= LODGE.right && rowIndex >= LODGE.top) return false;
  const mid = (NORTH_FACE.left + NORTH_FACE.right) / 2;
  const half = (NORTH_FACE.right - NORTH_FACE.left) / 2;
  const dx = Math.abs(col + 0.5 - mid);
  if (rowIndex <= NORTH_FACE.row + 3) return col >= NORTH_FACE.left && col <= NORTH_FACE.right && dx <= half;
  return dx <= half * 0.48;
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
  if (lodgeShellSolid(col, rowIndex)) return false;
  if (rowIndex === LODGE.bottom && col === LODGE.doorCols[0]) return true;
  const d = pathDistance(col, rowIndex);
  if (d <= 0.7) return true;
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
 * The south shore is grass down to the water. The pack bank draws the brown lip.
 * The old sand beach is gone: Guilherme asked for the grass coast.
 */
function inBeach(_col: number, _rowIndex: number): boolean {
  return false;
}

export function terrainAt(col: number, rowIndex: number): Terrain {
  if (col < 0 || rowIndex < 0 || col >= COLS || rowIndex >= ROWS) return 'void';
  if (!inIsland(col, rowIndex)) return 'water';
  if (inNorthPool(col, rowIndex)) return 'water';
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
export const GATE_COLS = YARD_MAP.gateCols;
export const GATE_ROW = southEdge(GATE_COLS[1]);


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
  { col: 28, row: 14 }, { col: 38, row: 14 }, { col: 18, row: 18 }, { col: 46, row: 22 },
  { col: 16, row: 26 }, { col: 50, row: 36 }, { col: 22, row: 46 }, { col: 42, row: 48 },
].filter((cell) => terrainAt(cell.col, cell.row) === 'grass');

/** Hand-placed props from the yard map. Scatter must keep clear of their cells. */
const FIXED: readonly PropPlacement[] = [
  ...YARD_MAP.props.map((prop) => ({
    kind: prop.kind as PropKind,
    col: prop.col,
    row: resolvePropRow(prop.col, prop.row),
  })),
  ...ISLETS.map((cell, index) => {
    const kind: PropKind = index % 2 === 0 ? 'rock' : 'shoreRock';
    return { kind, col: cell.col + (index % 2), row: cell.row };
  }),
].filter((prop) => {
  const ground = terrainAt(prop.col, prop.row);
  if (prop.kind === 'shoreRock') return ground === 'grass';
  if (prop.kind !== 'rock') return true;
  if (onIsletStone(prop)) return ground === 'grass';
  return ground === 'grass' || ground === 'sand';
});

function onIsletStone(prop: PropPlacement): boolean {
  return ISLETS.some((cell) => prop.col === cell.col && prop.row === cell.row);
}

function onIsletPad(col: number, row: number): boolean {
  return ISLETS.some((islet, index) => {
    const span = ISLET_SPAN[index] ?? { w: 2, h: 2 };
    return col >= islet.col && col < islet.col + span.w && row >= islet.row && row < islet.row + span.h;
  });
}

/** `gate` / `south` / `lodge`, optional `+N` or `-N`, resolved once the coast exists. */
function resolvePropRow(col: number, row: YardPropRow): number {
  if (typeof row === 'number') return row;
  const match = /^(gate|south|lodge)([+-]\d+)?$/.exec(row);
  if (!match) throw new Error(`yard-map: bad prop row "${row}"`);
  const base = match[1] === 'gate' ? GATE_ROW : match[1] === 'south' ? southEdge(col) : LODGE.bottom;
  const delta = match[2] ? Number(match[2]) : 0;
  return Math.max(0, base + delta);
}

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

/** Leisure standing cells. Scatter keeps off them. */
const LEISURE_CELLS: readonly Cell[] = LEISURE_DEFS.filter(
  (def) => def.kind === 'woodpile' || def.kind === 'garden',
);

/** Arrival line: the south path, from the house down to the gate. */
function inGateCorridor(col: number, rowIndex: number): boolean {
  return col >= 30 && col <= 34 && rowIndex >= LODGE.bottom && rowIndex <= GATE_ROW;
}

function scatterOk(col: number, rowIndex: number): boolean {
  if (lodgeShellSolid(col, rowIndex)) return false;
  if (terrainAt(col, rowIndex) !== 'grass' && terrainAt(col, rowIndex) !== 'sand') return false;
  if (FIXED_CLEARANCE.has(`${col},${rowIndex}`)) return false;
  if (inGateCorridor(col, rowIndex)) return false;
  return !LEISURE_CELLS.some((c) => Math.abs(c.col - col) <= 1 && Math.abs(c.row - rowIndex) <= 1);
}

const chebyshev = (a: Cell, b: Cell) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

const TREE_TARGET = 32;

/** A canopy is ~3 tiles wide. Keep the trunk off every fixed prop, including ones that do not block. */
function treeRoom(cell: Cell): boolean {
  const { left, right, top, bottom } = LODGE;
  if (cell.col >= left - 3 && cell.col <= right + 3 && cell.row >= top - 2 && cell.row <= bottom + 3) return false;
  return !FIXED.some((p) => propFootprint(p).some((b) => chebyshev(b, cell) <= 2));
}

/**
 * Rim trees: the island ellipse sampled about every 4 tiles of arc, first at 0.92 of its
 * radius, then on inner rings until the target count, so the field edge reads as woods.
 */
function rimTrees(existing: readonly Cell[]): Cell[] {
  const out: Cell[] = [];
  const all = [...existing];
  for (const ring of [0.5, 0.86, 0.74, 0.62]) {
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
  if (cell.row > ISLAND.cy + 12 && Math.abs(cell.col - ISLAND.cx) < 12) return;
  if (cell.col >= 14 && cell.col <= 19 && cell.row >= 27 && cell.row <= 32) return;
  if (terrainAt(cell.col, cell.row) !== 'grass' || !scatterOk(cell.col, cell.row) || !treeRoom(cell)) return;
  if (treeFootprint(cell).filter((part) => {
    const ground = terrainAt(part.col, part.row);
    return ground === 'water' || ground === 'void';
  }).length >= 7) return;
  if (pathDistance(cell.col, cell.row) <= 1.15) return;
  if (all.some((t) => chebyshev(t, cell) < 4)) return;
  all.push(cell);
  out.push(cell);
}

export const TREES: readonly Cell[] = (() => {
  const base: Cell[] = [];
  for (const cell of BASE_TREES) {
    if (!treeRoom(cell)) continue;
    if (base.some((t) => chebyshev(t, cell) < 4)) continue;
    base.push(cell);
  }
  return [...base, ...rimTrees(base)];
})();

const GARDEN = YARD_MAP.garden;

function inGarden(col: number, rowIndex: number): boolean {
  return col >= GARDEN.left && col <= GARDEN.right && rowIndex >= GARDEN.top && rowIndex <= GARDEN.bottom;
}

const BUSH_CAP = 22;
const BUSH_GAP_CAP = 30;
const RIM_BUSHES = 8;

function touchesWater(col: number, rowIndex: number): boolean {
  return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dc, dr]) => terrainAt(col + dc!, rowIndex + dr!) === 'water');
}

/** Eight bushes on the island step. The rest stay in the west and southeast gaps. */
function bushes(): Cell[] {
  const rim: Cell[] = [];
  for (let r = 0; r < ROWS && rim.length < RIM_BUSHES; r += 1) {
    for (let c = 0; c < COLS && rim.length < RIM_BUSHES; c += 1) {
      if (terrainAt(c, r) !== 'grass' || !touchesWater(c, r) || !scatterOk(c, r) || underCanopy(c, r)) continue;
      const landNeighbours = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dc, dr]) => terrainAt(c + dc!, r + dr!) === 'grass').length;
      if (landNeighbours < 2) continue;
      if (TREES.some((t) => chebyshev(t, { col: c, row: r }) <= 1)) continue;
      if (r > ISLAND.cy + 10 && Math.abs(c - ISLAND.cx) < 8) continue;
      if (pathDistance(c, r) <= 2.2) continue;
      if (rim.some((b) => chebyshev(b, { col: c, row: r }) < 2)) continue;
      rim.push({ col: c, row: r });
    }
  }
  const out = [...rim];
  for (let r = 0; r < ROWS && out.length < BUSH_CAP; r += 1) {
    for (let c = 0; c < COLS && out.length < BUSH_CAP; c += 1) {
      if (cellHash(c, r) % 2 !== 0) continue;
      if (terrainAt(c, r) !== 'grass' || !scatterOk(c, r) || inGarden(c, r) || touchesWater(c, r) || underCanopy(c, r)) continue;
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
  { col: 28, row: 35 },
  { col: 35, row: 34 },
  { col: 42, row: 34 },
  { col: 46, row: 39 },
  { col: 24, row: 33 },
  { col: 38, row: 28 },
  { col: 33, row: 24 },
  { col: 21, row: 36 },
].filter((c) => {
  if (terrainAt(c.col, c.row) !== 'grass' || pathDistance(c.col, c.row) <= 1.05) return false;
  if (BUSHES.some((b) => b.col === c.col && b.row === c.row)) return false;
  if (TREES.some((t) => treeFootprint(t).some((cell) => cell.col === c.col && cell.row === c.row))) return false;
  return !FIXED.some((p) => propFootprint(p).some((cell) => cell.col === c.col && cell.row === c.row));
});

const SHORE_ROCK_CAP = 22;

function shoreRocks(): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < ROWS && out.length < SHORE_ROCK_CAP; r += 1) {
    for (let c = 0; c < COLS && out.length < SHORE_ROCK_CAP; c += 1) {
      if (terrainAt(c, r) !== 'grass' || !touchesWater(c, r)) continue;
      if (c >= GATE_COLS[0] && c <= GATE_COLS[1]) continue;
      if (cellHash(c, r) % 3 !== 0) continue;
      if (TREES.some((t) => underCanopy(c, r) || (t.col === c && t.row === r))) continue;
      if (BUSHES.some((b) => b.col === c && b.row === r)) continue;
      if (FIXED.some((prop) => propFootprint(prop).some((cell) => cell.col === c && cell.row === r))) continue;
      out.push({ col: c, row: r });
    }
  }
  return out;
}

export const SHORE_ROCKS: readonly Cell[] = shoreRocks();

function underCanopy(col: number, rowIndex: number): boolean {
  return TREES.some((tree) => Math.abs(tree.col - col) <= 1 && rowIndex >= tree.row - 2 && rowIndex <= tree.row + 1);
}

/** Cells a tree's trunk and crown cover. Scatter and rocks stay outside this. */
export function treeFootprint(cell: Cell): Cell[] {
  const cells: Cell[] = [];
  for (let dr = -2; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      cells.push({ col: cell.col + dc, row: cell.row + dr });
    }
  }
  return cells;
}

/** Anchor cells a prop paints, plus a tree's crown. */
export function propFootprint(placement: PropPlacement): Cell[] {
  if (placement.kind === 'tree') return treeFootprint(placement);
  const { span } = PROP_SPECS[placement.kind];
  return Array.from({ length: span }, (_, dx) => ({ col: placement.col + dx, row: placement.row }));
}

/** Cottage sprite. Bottom-center sits on the door row, so the step lands on the portal cell. */
export const LODGE_ROOF: PropPlacement = { kind: 'lodgeRoof', col: LODGE.left, row: LODGE.bottom };

/** Opaque size of `lodge-house.png`, the tight crop of Houses/10.png. */
const LODGE_SPRITE = { w: 72, h: 95 } as const;

/** Sunflowers outnumber mushrooms. Strawberries stay out. Tall sprites keep the roof clear. */
function underTallSprite(col: number, row: number): boolean {
  const rise: Partial<Record<PropKind, number>> = {
    fishman: 6,
    greenhouse: 5,
    doghouse: 3,
    stall: 3,
    cherry: 3,
    fruitTree: 3,
    palm: 3,
    pine: 2,
  };
  for (const prop of [...FIXED, LODGE_ROOF]) {
    const up = prop.kind === 'lodgeRoof' ? 6 : rise[prop.kind];
    if (!up) continue;
    const span = PROP_SPECS[prop.kind].span;
    if (col >= prop.col - 1 && col < prop.col + span + 1 && row <= prop.row + 1 && row >= prop.row - up) return true;
  }
  return false;
}

/** Sparse accents: one small sprite in most 5×5 patches of open grass or sand. */
function decorations(): PropPlacement[] {
  const taken = new Set<string>();
  const mark = (col: number, row: number) => taken.add(`${col},${row}`);
  for (const p of [...FIXED, LODGE_ROOF]) {
    mark(p.col, p.row);
    mark(p.col + 1, p.row);
  }
  for (const t of TREES) {
    for (const cell of treeFootprint(t)) mark(cell.col, cell.row);
  }
  for (const b of BUSHES) mark(b.col, b.row);
  for (const r of SHORE_ROCKS) {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) mark(r.col + dc, r.row + dr);
    }
  }
  for (const lantern of LANTERNS) {
    mark(lantern.col, lantern.row);
    mark(lantern.col + 1, lantern.row);
  }
  const out: PropPlacement[] = [];
  for (let br = 0; br < ROWS; br += 5) {
    for (let bc = 0; bc < COLS; bc += 5) {
      // Leave some patches empty so flowers and mushrooms read as clusters, not ground fill.
      if (cellHash(bc, br) % 4 === 0) continue;
      const spots: Cell[] = [];
      for (let r = br; r < br + 5 && r < ROWS; r += 1) {
        for (let c = bc; c < bc + 5 && c < COLS; c += 1) {
          if (taken.has(`${c},${r}`)) continue;
          const ground = terrainAt(c, r);
          if (ground !== 'grass' || onIsletPad(c, r)) continue;
          if (!scatterOk(c, r) || underCanopy(c, r) || underTallSprite(c, r)) continue;
          spots.push({ col: c, row: r });
        }
      }
      if (spots.length === 0) continue;
      const cell = spots[cellHash(bc + 17, br + 31) % spots.length]!;
      out.push({
        kind: cellHash(cell.col, cell.row) % 3 === 0 ? 'mushroom' : 'flower',
        col: cell.col,
        row: cell.row,
      });
      taken.add(`${cell.col},${cell.row}`);
    }
  }
  return out;
}

const DECORATIONS = decorations();

export const PROPS: readonly PropPlacement[] = [
  ...FIXED.filter((prop) => prop.kind !== 'rock' || !underCanopy(prop.col, prop.row)),
  LODGE_ROOF,
  ...TREES.map((cell) => ({ kind: 'tree' as const, ...cell })),
  ...BUSHES.map((cell) => ({ kind: 'bush' as const, ...cell })),
  ...SHORE_ROCKS.map((cell) => ({ kind: 'shoreRock' as const, ...cell })),
  ...LANTERNS.map((cell) => ({ kind: 'lantern' as const, ...cell })),
  ...DECORATIONS,
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
