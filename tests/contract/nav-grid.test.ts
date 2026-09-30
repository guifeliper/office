import { describe, expect, it } from 'vitest';
import {
  CABIN_DOOR,
  CABIN_NAV,
  COFFEE_SPOTS,
  DESKS,
  GARDEN_SPOTS,
  GATEHOUSE,
  HEARTH_SPOTS,
  LODGE_DOOR,
  NAV,
  SOUTH_GATE,
  WOODPILE_SPOTS,
  arrivalPath,
  gridFor,
  routeTo,
  type ZonedPoint,
} from '../../src/renderer/office/landmarks';
import {
  GATE_COLS,
  GATE_ROW,
  LODGE,
  PROPS,
  TILE,
  blockedCells,
  cellAt,
  terrainAt,
  type PropKind,
} from '../../src/renderer/office/world-layout';
import { CABIN_DESKS, CABIN_PROPS, cabinBlockedCells, cabinTerrainAt } from '../../src/renderer/office/cabin-layout';

/** Walks every in-zone segment at 2px steps; each sample must sit on a walkable cell of that zone. */
function crossesOnlyWalkable(from: ZonedPoint, path: readonly ZonedPoint[]): boolean {
  let prev = from;
  for (const next of path) {
    if (next.zone !== prev.zone) {
      prev = next;
      continue;
    }
    const grid = gridFor(next.zone);
    const steps = Math.max(1, Math.ceil(Math.hypot(next.x - prev.x, next.y - prev.y) / 2));
    for (let i = 0; i <= steps; i += 1) {
      const cell = cellAt(prev.x + ((next.x - prev.x) * i) / steps, prev.y + ((next.y - prev.y) * i) / steps);
      if (!grid.walkable(cell.col, cell.row)) return false;
    }
    prev = next;
  }
  return true;
}

function cellsOf(kind: PropKind) {
  return PROPS.filter((p) => p.kind === kind).flatMap(blockedCells);
}

function passesNear(path: readonly ZonedPoint[], target: ZonedPoint): boolean {
  return path.some((p) => p.zone === target.zone && Math.hypot(p.x - target.x, p.y - target.y) < TILE);
}

describe('yard nav grid', () => {
  it('blocks fence, trunks, water, and the closed lodge shell; keeps gate and lodge door open', () => {
    for (const kind of ['fence', 'tree', 'gateLeft', 'campfire'] as const) {
      const cells = cellsOf(kind);
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) expect(NAV.walkable(cell.col, cell.row)).toBe(false);
    }
    expect(terrainAt(38, 5)).toBe('water');
    expect(NAV.walkable(38, 5)).toBe(false);
    expect(NAV.walkable(LODGE.left + 1, LODGE.bottom - 2)).toBe(false);
    expect(NAV.walkable(0, 0)).toBe(false);
    for (const col of GATE_COLS) expect(NAV.walkable(col, GATE_ROW)).toBe(true);
    for (const col of LODGE.doorCols) expect(NAV.walkable(col, LODGE.bottom)).toBe(true);
    expect(NAV.walkable(LODGE.doorCols[0], LODGE.bottom - 1)).toBe(false);
  });

  it('has no desk or chair in the yard', () => {
    expect(PROPS.some((p) => (p.kind as string) === 'desk' || (p.kind as string) === 'chair')).toBe(false);
  });
});

describe('cabin nav grid', () => {
  it('is 24×18 with desks, fireplace, and counter solid and the door open', () => {
    expect(CABIN_NAV.cols).toBe(24);
    expect(CABIN_NAV.rows).toBe(18);
    for (const p of CABIN_PROPS) {
      for (const cell of cabinBlockedCells(p)) expect(CABIN_NAV.walkable(cell.col, cell.row)).toBe(false);
    }
    expect(cabinTerrainAt(5, 0)).toBe('wall');
    const door = cellAt(CABIN_DOOR.x, CABIN_DOOR.y);
    expect(CABIN_NAV.walkable(door.col, door.row)).toBe(true);
  });

  it('has 16 workstations at distinct walkable seats inside the cabin', () => {
    expect(CABIN_DESKS).toHaveLength(16);
    expect(DESKS).toHaveLength(16);
    expect(new Set(DESKS.map((d) => `${d.x},${d.y}`)).size).toBe(16);
    for (const desk of DESKS) {
      expect(desk.zone).toBe('cabin');
      const cell = cellAt(desk.x, desk.y);
      expect(CABIN_NAV.walkable(cell.col, cell.row)).toBe(true);
      expect(cabinTerrainAt(cell.col, cell.row)).toBe('floor');
    }
  });
});

describe('routes across the door', () => {
  it('routes gate → gatehouse → lodge door → cabin door → every desk without crossing a solid cell', () => {
    for (const desk of DESKS) {
      const path = arrivalPath(SOUTH_GATE, desk);
      expect(path.at(-1)).toEqual({ x: desk.x, y: desk.y, zone: 'cabin' });
      expect(passesNear(path, GATEHOUSE)).toBe(true);
      expect(passesNear(path, LODGE_DOOR)).toBe(true);
      expect(passesNear(path, CABIN_DOOR)).toBe(true);
      expect(crossesOnlyWalkable(SOUTH_GATE, path)).toBe(true);
    }
  });

  it('reaches every leisure spot from a desk and back, without the gate', () => {
    for (const spot of [...HEARTH_SPOTS, ...COFFEE_SPOTS, ...WOODPILE_SPOTS, ...GARDEN_SPOTS]) {
      const cell = cellAt(spot.x, spot.y);
      expect(gridFor(spot.zone).walkable(cell.col, cell.row)).toBe(true);
      const out = routeTo(DESKS[5]!, spot);
      expect(out.at(-1)).toEqual({ x: spot.x, y: spot.y, zone: spot.zone });
      expect(crossesOnlyWalkable(DESKS[5]!, out)).toBe(true);
      const back = routeTo(spot, DESKS[5]!);
      expect(crossesOnlyWalkable(spot, back)).toBe(true);
      expect(passesNear(back, SOUTH_GATE)).toBe(false);
    }
  });
});
