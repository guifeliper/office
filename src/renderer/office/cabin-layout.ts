/**
 * Cabana Norte: the room the app opens in. 24×18 cells of 16 px.
 * Every sprite placed here is a Tiny Farm crop (`scripts/cut-cabin.ts`). Pure data.
 */

export const CABIN_COLS = 24;
export const CABIN_ROWS = 18;
const TILE = 16;

export type CabinTerrain = 'void' | 'wall' | 'floor';

/** North wall height in cells. The pack wall strip is 3 tiles tall. */
export const WALL_ROWS = 3;

export function cabinTerrainAt(col: number, row: number): CabinTerrain {
  if (col < 0 || row < 0 || col >= CABIN_COLS || row >= CABIN_ROWS) return 'void';
  return row < WALL_ROWS ? 'wall' : 'floor';
}

export type CabinPropKind =
  | 'desk'
  | 'computer'
  | 'chair'
  | 'fireplace'
  | 'bookshelf'
  | 'plant'
  | 'counter'
  | 'kettle'
  | 'mug'
  | 'armchair'
  | 'cat'
  | 'door';

export interface CabinPropSpec {
  /** Tiles wide. The sprite's bottom-center sits on the bottom edge of this span. */
  span: number;
  /** Solid cells relative to (col, row): dx in [0, span), dy <= 0. */
  blocks: readonly (readonly [number, number])[];
}

const row = (span: number, dy = 0): [number, number][] =>
  Array.from({ length: span }, (_, dx) => [dx, dy] as [number, number]);

export const CABIN_PROP_SPECS: Record<CabinPropKind, CabinPropSpec> = {
  desk: { span: 2, blocks: row(2) },
  computer: { span: 2, blocks: [] },
  chair: { span: 1, blocks: [] },
  fireplace: { span: 2, blocks: row(2) },
  bookshelf: { span: 2, blocks: row(2) },
  plant: { span: 1, blocks: row(1) },
  counter: { span: 3, blocks: row(3) },
  kettle: { span: 2, blocks: row(2) },
  mug: { span: 1, blocks: [] },
  armchair: { span: 2, blocks: row(2) },
  cat: { span: 2, blocks: [] },
  door: { span: 2, blocks: [] },
};

export interface CabinPlacement {
  kind: CabinPropKind;
  col: number;
  row: number;
}

/**
 * Two rows of eight desks. Each row is two groups of four, side by side,
 * with a two-cell aisle between the groups. The chair sits one row south.
 */
const GROUP_COLS = [1, 11] as const;
const DESK_ROWS = [8, 12] as const;

export const CABIN_DESKS: readonly CabinPlacement[] = DESK_ROWS.flatMap((r) =>
  GROUP_COLS.flatMap((c) => [0, 2, 4, 6].map((dx) => ({ kind: 'desk' as const, col: c + dx, row: r }))),
);

/** Four chairs facing the fire. They are leisure seats, not workstations. */
export const HEARTH_CHAIR_CELLS = [
  { col: 9, row: 5 },
  { col: 10, row: 5 },
  { col: 13, row: 5 },
  { col: 14, row: 5 },
] as const;

/** Two standing spots at the coffee counter, facing it. */
export const COFFEE_CELLS = [
  { col: 1, row: 16 },
  { col: 3, row: 16 },
] as const;

/**
 * Four standing cells beside the door, off the portal itself.
 * Extra active consultants wait here. There is no fifth spot.
 */
export const DOOR_QUEUE_CELLS = [
  { col: 8, row: 16 },
  { col: 9, row: 16 },
  { col: 14, row: 16 },
  { col: 15, row: 16 },
] as const;

/** The portal. Walkable; clicking it returns to the yard. */
export const CABIN_DOOR = { col: 11, row: 17, span: 2 } as const;
export const CABIN_DOOR_CELL = { col: CABIN_DOOR.col, row: CABIN_DOOR.row } as const;

export function seatCell(desk: CabinPlacement): { col: number; row: number } {
  return { col: desk.col + 1, row: desk.row + 1 };
}

export const CABIN_PROPS: readonly CabinPlacement[] = [
  ...CABIN_DESKS,
  ...CABIN_DESKS.map((d) => ({ kind: 'computer' as const, col: d.col, row: d.row })),
  ...CABIN_DESKS.map((d) => ({ kind: 'chair' as const, ...seatCell(d) })),
  { kind: 'fireplace', col: 9, row: WALL_ROWS },
  { kind: 'bookshelf', col: 5, row: WALL_ROWS },
  { kind: 'bookshelf', col: 16, row: WALL_ROWS },
  ...HEARTH_CHAIR_CELLS.map((c) => ({ kind: 'chair' as const, ...c })),
  { kind: 'cat', col: 10, row: 4 },
  { kind: 'plant', col: 1, row: WALL_ROWS },
  { kind: 'plant', col: 22, row: WALL_ROWS },
  { kind: 'counter', col: 1, row: 15 },
  { kind: 'mug', col: 2, row: 15 },
  { kind: 'kettle', col: 4, row: 15 },
  { kind: 'armchair', col: 19, row: 16 },
  { kind: 'door', col: CABIN_DOOR.col, row: CABIN_DOOR.row },
];

export function cabinBlockedCells(p: CabinPlacement): { col: number; row: number }[] {
  return CABIN_PROP_SPECS[p.kind].blocks.map(([dx, dy]) => ({ col: p.col + dx, row: p.row + dy }));
}

/** World point where the prop's base sits: bottom-center of its span. */
export function cabinPropBase(p: CabinPlacement): { x: number; y: number } {
  const { span } = CABIN_PROP_SPECS[p.kind];
  return { x: (p.col + span / 2) * TILE, y: (p.row + 1) * TILE };
}

export const CABIN_WORLD = { width: CABIN_COLS * TILE, height: CABIN_ROWS * TILE } as const;

/**
 * Tiny Farm character cell: 32×32. Standing feet end on row 25 of the cell,
 * so the feet line (anchor) is row 26. Measured on every idle and walk frame.
 */
export const CAST_CELL = 32;
export const CAST_FEET_ROW = 26;

/**
 * Sit anchor, measured: the chair cell (16×32) and the sit cell (32×32) share the same
 * bottom line and the same center, so the sit frame's origin is the chair's origin −8 px.
 * With the body anchored at the feet line, the chair's bottom sits this far below the feet.
 */
export const SEAT_DROP = CAST_CELL - CAST_FEET_ROW;

/** Seat point (feet anchor) for a chair cell: cell center x, SEAT_DROP above the cell bottom. */
export function chairSeat(cell: { col: number; row: number }): { x: number; y: number } {
  return { x: cell.col * TILE + TILE / 2, y: (cell.row + 1) * TILE - SEAT_DROP };
}

/** Desk seat: the chair one row south of the desk, at the desk's center column. */
export function deskSeat(desk: CabinPlacement): { x: number; y: number } {
  const seat = seatCell(desk);
  return { x: (desk.col + 1) * TILE, y: (seat.row + 1) * TILE - SEAT_DROP };
}

/** Where the chair sprite (bottom-center anchor) goes for a given seat point. */
export function chairBaseFor(seat: { x: number; y: number }): { x: number; y: number } {
  return { x: seat.x, y: seat.y + SEAT_DROP };
}

/** Desk chairs are centered on the desk (x on a cell edge); hearth chairs on their cell. */
export function chairAnchor(chair: CabinPlacement): { x: number; y: number } {
  const desk = CABIN_DESKS.find((d) => {
    const s = seatCell(d);
    return s.col === chair.col && s.row === chair.row;
  });
  return chairBaseFor(desk ? deskSeat(desk) : chairSeat(chair));
}

/**
 * Transparent rows under the opaque art in each pack cell, so the visible bottom
 * lands on the placement's base line. Measured by `scripts/cut-cabin.ts`.
 */
const CELL_FOOT: Record<CabinPropKind, number> = {
  desk: 5,
  computer: 1,
  chair: 0,
  fireplace: 1,
  bookshelf: 1,
  plant: 2,
  counter: 0,
  kettle: 1,
  mug: 1,
  armchair: 1,
  cat: 1,
  door: 6,
};

/** The computer's keyboard rests on the desk top, not on the floor line. */
export const COMPUTER_LIFT = 9;
/** The mug stands on the counter top. */
export const MUG_LIFT = 17;

/**
 * Bottom-center anchor and draw depth for a cabin sprite.
 * Chairs draw in front of the sitter: the pack sit-north pose sits behind the chair back.
 */
export function cabinSpriteAnchor(p: CabinPlacement): { x: number; y: number; z: number } {
  if (p.kind === 'chair') {
    const base = chairAnchor(p);
    return { x: base.x, y: base.y, z: base.y - SEAT_DROP + 0.25 };
  }
  const base = cabinPropBase(p);
  const y = base.y + CELL_FOOT[p.kind];
  if (p.kind === 'computer') return { x: base.x, y: y - COMPUTER_LIFT, z: base.y + 0.1 };
  if (p.kind === 'mug') return { x: base.x, y: y - MUG_LIFT, z: base.y + 0.1 };
  return { x: base.x, y, z: base.y };
}

/** Flame cycle over the fireplace opening: the pack flame cell sits 27 px into the hearth cell. */
export function flameAnchor(fireplace: CabinPlacement): { x: number; y: number; z: number } {
  const { x, y, z } = cabinSpriteAnchor(fireplace);
  return { x, y: y - 48 + 27 + 16, z: z + 0.1 };
}

/** Screen rect of the door sprite in cabin world pixels, for the click target. */
export function cabinDoorRect(): { x: number; y: number; w: number; h: number } {
  return { x: CABIN_DOOR.col * TILE, y: (CABIN_DOOR.row - 1) * TILE, w: CABIN_DOOR.span * TILE, h: 2 * TILE };
}
