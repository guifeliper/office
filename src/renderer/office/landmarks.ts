import { NavGrid } from './nav-grid';
import { LEISURE_DEFS, LEISURE_SEATED, LEISURE_ZONE, assignLeisure, type LeisureDef, type Zone } from './leisure';
import {
  CABIN_COLS,
  CABIN_DESKS,
  CABIN_DOOR_CELL,
  CABIN_PROPS,
  CABIN_ROWS,
  cabinBlockedCells,
  cabinTerrainAt,
  chairSeat,
  deskSeat,
} from './cabin-layout';
import {
  COLS,
  GATE_COLS,
  GATE_ROW,
  LODGE,
  ROWS,
  TILE,
  cellAt,
  cellCenter,
  type Cell,
} from './world-layout';

/**
 * Named spots on two grids of 16 px cells: the 64×64 yard (`world-layout.ts`) and the
 * 24×18 cabin (`cabin-layout.ts`). Every waypoint carries its zone. Routes inside a zone
 * come from A*; a route across zones walks to this side's door and resumes at the other.
 */

export type { Zone } from './leisure';
export type Facing = 'south' | 'north' | 'east' | 'west';

export interface Point {
  x: number;
  y: number;
}

export interface ZonedPoint extends Point {
  zone: Zone;
}

export interface Waypoint extends ZonedPoint {
  /** Direction a consultant faces while standing here. */
  facing: Facing;
}

export const WORLD = { width: COLS * TILE, height: ROWS * TILE } as const;

export const NAV = new NavGrid();

export const CABIN_NAV = new NavGrid({
  cols: CABIN_COLS,
  rows: CABIN_ROWS,
  terrain: cabinTerrainAt,
  solid: CABIN_PROPS.flatMap(cabinBlockedCells),
});

export function gridFor(zone: Zone): NavGrid {
  return zone === 'cabin' ? CABIN_NAV : NAV;
}

function at(cell: Cell, facing: Facing, zone: Zone = 'yard'): Waypoint {
  return { ...cellCenter(cell), facing, zone };
}

/** Passage cell in the south fence gate. New consultants spawn here. */
export const SOUTH_GATE: Waypoint = at({ col: GATE_COLS[1], row: GATE_ROW }, 'north');

/** Between the gatehouse pillars, a few cells north of the south gate. */
export const GATEHOUSE: Waypoint = at({ col: GATE_COLS[1], row: GATE_ROW - 3 }, 'north');

/** Door gap in the yard lodge's front wall. The yard end of the portal. */
export const LODGE_DOOR: Waypoint = at({ col: LODGE.doorCols[0], row: LODGE.bottom }, 'north');

/** The cabin end of the portal. */
export const CABIN_DOOR: Waypoint = at(CABIN_DOOR_CELL, 'north', 'cabin');

function doorOf(zone: Zone): Waypoint {
  return zone === 'cabin' ? CABIN_DOOR : LODGE_DOOR;
}

/** Sixteen seats in the cabin, one per desk, facing the computer. X is the desk center. */
export const DESKS: readonly Waypoint[] = CABIN_DESKS.map((desk) => ({ ...deskSeat(desk), facing: 'north' as const, zone: 'cabin' as const }));

export function waypointFor(def: LeisureDef): Waypoint {
  const zone = LEISURE_ZONE[def.kind];
  if (LEISURE_SEATED[def.kind]) return { ...chairSeat(def), facing: def.facing, zone };
  return at({ col: def.col, row: def.row }, def.facing, zone);
}

function spotsOf(kind: LeisureDef['kind']): Waypoint[] {
  return LEISURE_DEFS.filter((def) => def.kind === kind).map(waypointFor);
}

export const HEARTH_SPOTS: readonly Waypoint[] = spotsOf('hearth');
export const COFFEE_SPOTS: readonly Waypoint[] = spotsOf('coffee');

/** Beside the stump and the woodpile. */
export const WOODPILE_SPOTS: readonly Waypoint[] = spotsOf('woodpile');

/** In the aisle between the garden beds. */
export const GARDEN_SPOTS: readonly Waypoint[] = spotsOf('garden');

export interface Placement {
  /** Preferred desk index; the presence director moves to the next free one on collision. */
  deskIndex: number;
  desk: Waypoint;
  leisure: Waypoint;
  /** Gate cell for a first arrival; two passage cells so concurrent arrivals do not stack. */
  gate: Waypoint;
}

/** Stable desk and leisure spot for a consultant id. Look comes from the conversation, not this hash. */
export function placeConsultant(id: string): Placement {
  const h = hashId(id);
  const deskIndex = h % DESKS.length;
  const leisure = waypointFor(assignLeisure(id, new Set()));
  const gateCol = GATE_COLS[(h >>> 16) % GATE_COLS.length]!;
  return {
    deskIndex,
    desk: DESKS[deskIndex]!,
    leisure,
    gate: at({ col: gateCol, row: GATE_ROW }, 'north'),
  };
}

function routeWithin(from: Point, to: Point, grid: NavGrid): Point[] {
  const start = grid.nearestWalkable(from.x, from.y);
  const goal = grid.nearestWalkable(to.x, to.y);
  const path = start.col === goal.col && start.row === goal.row ? [cellCenter(goal)] : grid.findPath(start, goal);
  const goalCell = cellAt(to.x, to.y);
  if (path.length > 0 && goalCell.col === goal.col && goalCell.row === goal.row) {
    path[path.length - 1] = { x: to.x, y: to.y };
  }
  return path;
}

/**
 * Grid route to a waypoint. [] when the target is unreachable.
 * Points without a zone are treated as yard points.
 */
export function routeTo(from: Point & { zone?: Zone }, to: Point & { zone?: Zone }, grid?: NavGrid): ZonedPoint[] {
  const fromZone = from.zone ?? 'yard';
  const toZone = to.zone ?? 'yard';
  const tag = (zone: Zone) => (p: Point): ZonedPoint => ({ x: p.x, y: p.y, zone });
  if (fromZone === toZone) return routeWithin(from, to, grid ?? gridFor(fromZone)).map(tag(fromZone));
  const out = routeWithin(from, doorOf(fromZone), gridFor(fromZone)).map(tag(fromZone));
  const entry = doorOf(toZone);
  out.push({ x: entry.x, y: entry.y, zone: toZone });
  out.push(...routeWithin(entry, to, gridFor(toZone)).map(tag(toZone)));
  return out;
}

/** Gate → gatehouse → lodge door → cabin door → desk, each leg routed on its grid. */
export function arrivalPath(from: ZonedPoint | Point, desk: ZonedPoint): ZonedPoint[] {
  const legs: ZonedPoint[] = [];
  let cursor: Point & { zone?: Zone } = from;
  for (const stop of [GATEHOUSE, desk]) {
    legs.push(...routeTo(cursor, stop));
    cursor = stop;
  }
  return legs;
}

function hashId(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}
