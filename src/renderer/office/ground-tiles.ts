import { LAWN_DECALS, PATH_DECALS, WATER_DECALS } from '../../../.cache/tiny-farm/tiles/decals';
import { CLIFF_CAP_PX, CLIFF_FOOT_PX, CLIFF_WALL_PX, DARK_EDGE, SHORE_BANK } from '../../../.cache/tiny-farm/tiles/shores';
import { TILE_PX, type GroundTileName } from '../../../.cache/tiny-farm/tiles/pixels';
import { YARD_GROUND, type YardGroundName } from '../../../.cache/tiny-farm/tiles/yard-ground';
import {
  COLS,
  LODGE,
  ROWS,
  YARD_MAP,
  TREES,
  cellHash,
  cliffRunAt,
  elevationAt,
  pathDistance,
  terrainAt,
  type Terrain,
} from './world-layout';

/**
 * Every yard cell is a Tiny Farm crop loaded from the gitignored `.cache/tiny-farm`.
 * The cottage is a sprite, not a painted roof.
 * The cell hash only picks which whole tile to stamp.
 */
export const RAMP = {
  /** Warmer than grassLight. Sun on the north of a leaf or tuft. */
  grassSun: 0xa8d07a,
  grassLight: 0x7aaa62,
  grass: 0x5b8f4e,
  grassDark: 0x3e6a38,
  grassDeep: 0x2a4a26,
  pathLight: 0xfff8f1,
  path: 0xf3e8d4,
  pathDark: 0xd9c4a4,
  /** Worn centre. Darker than the sand base, still warm. */
  pathWorn: 0xc6ae90,
  /** Cool taupe rim. Darker and less yellow than pathDark. */
  pathShade: 0x7a756c,
  waterLight: 0x7aabca,
  water: 0x4a7c9b,
  waterDark: 0x2f5874,
  stoneLight: 0xd4cbc0,
  stone: 0xa3988c,
  stoneDark: 0x5e564e,
  woodLight: 0xe6c49a,
  wood: 0xc4925a,
  woodDark: 0x8a5a30,
  woodDeep: 0x4a3018,
  gold: 0xd4a04a,
  ink: 0x201b0f,
} as const;

/** Max distinct colors inside one tile, by terrain. */
export const TILE_COLOR_LIMIT: Record<Exclude<Terrain, 'void'>, number> = {
  // Five grass tones, or a flower (cream + gold) on four of them.
  grass: 6,
  // Five path tones plus the grass bite on the rim.
  path: 6,
  water: 4,
  sand: 8,
  floor: 3,
  wall: 3,
};

export type GrassTile = 'grass-0' | 'grass-1' | 'grass-dark';

/** Light flat and the darker flat. Trunk shade uses the dark one under its own name. */
let grassGrid: (GrassTile | null)[] | null = null;

export function grassTileAt(col: number, row: number): GrassTile | null {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
  grassGrid ??= buildGrassGrid();
  return grassGrid[row * COLS + col] ?? null;
}

/**
 * Shade falls south: within Chebyshev 2 of a trunk and on a lower row. The two far
 * corners are dropped so the patch reads as a rounded shadow, not a 5×2 mat.
 */
export function inTrunkShade(col: number, row: number): boolean {
  return TREES.some((t) => {
    const dc = Math.abs(t.col - col);
    const dr = row - t.row;
    return dr > 0 && dr <= 2 && dc <= 2 && !(dc === 2 && dr === 2);
  });
}

/**
 * Scene B keeps light grass along paths and around the house, and lays dark grass
 * as a few large masses on the wild ground and on raised ground. Here that is every
 * grass cell far enough from a path, plus each terrace top. The ground right under a
 * terrace stays light, so the dark ledge reads as a step down.
 */
const DARK_PATH_CLEARANCE = 8.5;
const LIGHT_YARD = { left: LODGE.left - 4, right: LODGE.right + 4, top: LODGE.top - 3, bottom: LODGE.bottom + 3 } as const;
const GARDEN_YARD = {
  left: YARD_MAP.garden.left - 1,
  right: YARD_MAP.garden.right + 1,
  top: YARD_MAP.garden.top - 1,
  bottom: YARD_MAP.garden.bottom + 1,
} as const;

function inBox(col: number, row: number, box: { left: number; right: number; top: number; bottom: number }): boolean {
  return col >= box.left && col <= box.right && row >= box.top && row <= box.bottom;
}

function belowTerrace(col: number, row: number): boolean {
  if (elevationAt(col, row) === 2) return false;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (elevationAt(col + dc, row + dr) === 2) return true;
    }
  }
  return false;
}

function darkAllowed(col: number, row: number): boolean {
  if (terrainAt(col, row) !== 'grass' || cliffRunAt(col, row + 1) || belowTerrace(col, row)) return false;
  // The south shelf is one lawn down to the bank. A dark mass there reads as a rectangle.
  if (row >= 48) return false;
  if (autotileIndex((dc, dr) => openWater(col + dc, row + dr)) !== null) return false;
  return !inBox(col, row, LIGHT_YARD) && !inBox(col, row, GARDEN_YARD);
}

function darkSeed(col: number, row: number): boolean {
  if (!darkAllowed(col, row)) return false;
  return elevationAt(col, row) === 2 || pathDistance(col, row) > DARK_PATH_CLEARANCE;
}

/**
 * Masses only: a dark cell needs a dark neighbour on both axes, so the autotile never
 * draws a one-tile strip, and a light cell boxed in on three sides fills in.
 */
function darkMask(): Uint8Array {
  let mask = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) mask[r * COLS + c] = darkSeed(c, r) ? 1 : 0;
  const on = (m: Uint8Array, c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && m[r * COLS + c] === 1;
  for (let pass = 0; pass < 6; pass += 1) {
    const next = mask.slice();
    let changed = false;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const i = r * COLS + c;
        const north = on(mask, c, r - 1);
        const south = on(mask, c, r + 1);
        const west = on(mask, c - 1, r);
        const east = on(mask, c + 1, r);
        const around = [north, east, south, west].filter(Boolean).length;
        const thick = (north || south) && (west || east);
        if (mask[i] === 1 && !thick) next[i] = 0;
        else if (mask[i] === 0 && around >= 3 && darkAllowed(c, r)) next[i] = 1;
        changed ||= next[i] !== mask[i];
      }
    }
    mask = next;
    if (!changed) break;
  }
  return mask;
}

function buildGrassGrid(): (GrassTile | null)[] {
  const grid: (GrassTile | null)[] = new Array(COLS * ROWS).fill(null);
  const dark = darkMask();
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (terrainAt(c, r) !== 'grass') continue;
      if (dark[r * COLS + c] === 1) grid[r * COLS + c] = 'grass-1';
      else grid[r * COLS + c] = inTrunkShade(c, r) ? 'grass-dark' : 'grass-0';
    }
  }
  return grid;
}

/** 16×16 RGB pixels for a cell, or null for the cream void. */
export function paintCell(col: number, row: number): Int32Array | null {
  const base = paintBase(col, row);
  if (!base) return null;
  const decal = groundDecalAt(col, row);
  return decal ? composite(base, decal) : base;
}

/**
 * Scene B's ground cover, about 8 lawn decals and 4 dirt spots per 10×10 tiles.
 * Only on interior cells, so no decal sits across an autotile rim.
 */
export function groundDecalAt(col: number, row: number): Int32Array | null {
  const terrain = terrainAt(col, row);
  const roll = (cellHash(col, row) % 1000) / 1000;
  const pick = (list: readonly Int32Array[]) => list[cellHash(row + 101, col + 7) % list.length]!;
  const cardinals = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  if (terrain === 'grass') {
    if (roll >= 0.28 || !plainGrass(col, row)) return null;
    const tone = grassTileAt(col, row) === 'grass-0';
    const same = cardinals.every(([dc, dr]) => plainGrass(col + dc, row + dr) && (grassTileAt(col + dc, row + dr) === 'grass-0') === tone);
    return same ? pick(LAWN_DECALS) : null;
  }
  if (terrain === 'path') {
    if (roll >= 0.12) return null;
    return cardinals.every(([dc, dr]) => terrainAt(col + dc, row + dr) === 'path') ? pick(PATH_DECALS) : null;
  }
  if (terrain === 'water') {
    if (roll >= 0.05 || !openWater(col, row) || !nearLand(col, row)) return null;
    return cardinals.every(([dc, dr]) => openWater(col + dc, row + dr) && terrainAt(col + dc, row + dr) === 'water') ? pick(WATER_DECALS) : null;
  }
  return null;
}

function nearLand(col: number, row: number): boolean {
  for (let dr = -2; dr <= 2; dr += 1) {
    for (let dc = -2; dc <= 2; dc += 1) {
      const t = terrainAt(col + dc, row + dr);
      if (t !== 'water' && t !== 'void') return true;
    }
  }
  return false;
}

/** Grass painted as a flat or dark rim: no bank, no ledge, no cliff above. */
function plainGrass(col: number, row: number): boolean {
  if (terrainAt(col, row) !== 'grass') return false;
  if (cliffRunAt(col, row + 1)) return false;
  return autotileIndex((dc, dr) => openWater(col + dc, row + dr)) === null;
}

function paintBase(col: number, row: number): Int32Array | null {
  const terrain = terrainAt(col, row);
  if (terrain === 'void') return null;
  if (terrain === 'grass') {
    const bank = bankPixels(col, row);
    if (bank) return bank;
  }
  return paintSurface(col, row);
}

function paintSurface(col: number, row: number): Int32Array {
  switch (terrainAt(col, row)) {
    case 'grass':
      return paintGrass(col, row);
    case 'path':
      return paintPath(col, row);
    case 'water':
      return paintWater(col, row);
    case 'sand':
      return copyYard('sand');
    case 'floor':
      return paintFloor(col, row);
    case 'wall':
      return paintWall(col, row);
    default:
      return copyYard('water');
  }
}

function composite(base: Int32Array, over: Int32Array): Int32Array {
  const out = base.slice();
  for (let i = 0; i < over.length; i += 1) {
    const color = over[i]!;
    if (color >= 0) out[i] = color;
  }
  return out;
}

function copyTile(name: GroundTileName): Int32Array {
  return TILE_PX[name].slice();
}

function copyYard(name: YardGroundName): Int32Array {
  return YARD_GROUND[name].slice();
}

/**
 * Outside bits: N=8, E=4, S=2, W=1. A clear mask is interior dirt; one diagonal
 * of grass on that interior uses the inner-corner crop so a bend is not a square.
 */
export function pathTileAt(col: number, row: number): GroundTileName {
  const path = (dc: number, dr: number) => terrainAt(col + dc, row + dr) === 'path';
  const mask = (path(0, -1) ? 0 : 8) | (path(1, 0) ? 0 : 4) | (path(0, 1) ? 0 : 2) | (path(-1, 0) ? 0 : 1);
  if (mask === 0) {
    if (!path(-1, -1)) return 'path-in-nw';
    if (!path(1, -1)) return 'path-in-ne';
    if (!path(1, 1)) return 'path-in-se';
    if (!path(-1, 1)) return 'path-in-sw';
    return 'path-center';
  }
  const tiles: Record<number, GroundTileName> = {
    8: 'path-n',
    4: 'path-e',
    2: 'path-s',
    1: 'path-w',
    12: 'path-ne',
    9: 'path-nw',
    6: 'path-se',
    3: 'path-sw',
    10: 'path-ns',
    5: 'path-ew',
    13: 'path-end-s',
    7: 'path-end-n',
    11: 'path-end-e',
    14: 'path-end-w',
    15: 'path-island',
  };
  return tiles[mask] ?? 'path-center';
}

function isMass(col: number, row: number): boolean {
  return grassTileAt(col, row) === 'grass-1';
}

/**
 * Cardinal mask of a dark-mass edge. N=8, E=4, S=2, W=1.
 * Null on light grass, trunk shade, and the interior of a mass.
 */
export function darkEdgeMask(col: number, row: number): number | null {
  if (!isMass(col, row)) return null;
  const outside = (dc: number, dr: number) => !isMass(col + dc, row + dr);
  const mask = (outside(0, -1) ? 8 : 0) | (outside(1, 0) ? 4 : 0) | (outside(0, 1) ? 2 : 0) | (outside(-1, 0) ? 1 : 0);
  return mask === 0 ? null : mask;
}

/** The wave tile. Only where the cell and the cell south of it are water, under the cliff wall. */
export function cliffFootAt(col: number, row: number): boolean {
  if (terrainAt(col, row) !== 'water' || !cliffRunAt(col, row - 2)) return false;
  const south = terrainAt(col, row + 1);
  return south === 'water' || south === 'void';
}

function paintGrass(col: number, row: number): Int32Array {
  const tile = grassTileAt(col, row);
  if (tile !== 'grass-1') return copyTile(tile === 'grass-dark' ? 'grass-1' : 'grass-0');
  const index = autotileIndex((dc, dr) => !isMass(col + dc, row + dr));
  if (index === null) return copyTile('grass-1');
  return composite(copyTile('grass-0'), DARK_EDGE[index]!);
}

function paintPath(col: number, row: number): Int32Array {
  return copyTile(pathTileAt(col, row));
}


/**
 * South cliff is three tiles: grass cap over the lawn, dirt wall, and the wave foot
 * over water. Other water stays flat.
 */
function paintWater(col: number, row: number): Int32Array {
  const base = copyYard('water');
  if (cliffRunAt(col, row)) {
    const west = cliffRunAt(col - 1, row);
    const east = cliffRunAt(col + 1, row);
    const cap = !west && east ? CLIFF_CAP_PX[1]! : west && !east ? CLIFF_CAP_PX[2]! : CLIFF_CAP_PX[0]!;
    return composite(copyTile('grass-0'), cap);
  }
  if (cliffRunAt(col, row - 1)) return composite(base, CLIFF_WALL_PX[0]!);
  if (cliffFootAt(col, row)) return composite(base, CLIFF_FOOT_PX[Math.abs(col) % 2]!);
  if (cliffRunAt(col, row - 2)) return composite(base, CLIFF_WALL_PX[0]!);
  return base;
}

/**
 * Grass autotile index. Same mask as the dirt autotile: a set bit is outside on that side.
 * Index is into a 12 × 4 block of the grass sheet, stored row-major.
 */
const BANK_AT: Record<number, number> = {
  0: 33, 8: 10, 4: 35, 2: 45, 1: 13, 12: 11, 9: 1, 6: 47, 3: 44, 5: 12, 10: 38, 7: 24, 11: 37, 13: 0, 14: 39, 15: 36,
};
const BANK_INNER = { nw: 17, ne: 18, se: 30, sw: 29 } as const;

/** The ocean past the island is void, painted as the same water. */
function openWater(col: number, row: number): boolean {
  const terrain = terrainAt(col, row);
  if (terrain === 'void') return true;
  if (terrain !== 'water') return false;
  return !cliffRunAt(col, row) && !cliffRunAt(col, row - 1) && !cliffRunAt(col, row - 2);
}

/** Null when no side or corner is outside: the cell is a plain flat. */
function autotileIndex(outside: (dc: number, dr: number) => boolean): number | null {
  const mask = (outside(0, -1) ? 8 : 0) | (outside(1, 0) ? 4 : 0) | (outside(0, 1) ? 2 : 0) | (outside(-1, 0) ? 1 : 0);
  if (mask !== 0) return BANK_AT[mask] ?? null;
  if (outside(-1, -1)) return BANK_INNER.nw;
  if (outside(1, -1)) return BANK_INNER.ne;
  if (outside(1, 1)) return BANK_INNER.se;
  if (outside(-1, 1)) return BANK_INNER.sw;
  return null;
}

/** The light grass autotile laid over water: its hole is the pond, its rim the dark outline. */
function bankPixels(col: number, row: number): Int32Array | null {
  const index = autotileIndex((dc, dr) => openWater(col + dc, row + dr));
  if (index === null) return null;
  return composite(copyYard('water'), SHORE_BANK[index]!);
}

/** Kept for the terrain union. The yard cottage is a sprite, so this no longer stamps the shell. */
function paintFloor(col: number, row: number): Int32Array {
  return copyYard(cellHash(col, row) % 2 === 0 ? 'roof' : 'roof-b');
}

function paintWall(_col: number, _row: number): Int32Array {
  return copyYard('roof-edge');
}
