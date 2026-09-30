import type { Facing, Waypoint, Zone } from './landmarks';
import { cellCenter } from './world-layout';
import { idHash } from './bug-cycle';

/** Measured walkable cells. Stump prop is (15, 28); pile prop is (17, 28). Cat is (10, 4). Armchair blocks (19–20, 16). */
export interface Station {
  col: number;
  row: number;
  facing: Facing;
  zone: Zone;
}

export const STATIONS = {
  stump: { col: 15, row: 29, facing: 'north', zone: 'yard' },
  pile: { col: 17, row: 29, facing: 'north', zone: 'yard' },
  pet: { col: 11, row: 5, facing: 'north', zone: 'cabin' },
  sleep: { col: 18, row: 16, facing: 'east', zone: 'cabin' },
} as const satisfies Record<string, Station>;

export function stationKey(station: Station): string {
  return `${station.zone}:${station.col},${station.row}`;
}

export function stationWaypoint(station: Station): Waypoint {
  return { ...cellCenter(station), facing: station.facing, zone: station.zone };
}

/** Smallest hash wins, so the same id keeps the job while they stay eligible. */
export function pickOne(ids: readonly string[], salt: string): string | null {
  if (ids.length === 0) return null;
  return [...ids].sort((a, b) => {
    const delta = idHash(`${a}:${salt}`) - idHash(`${b}:${salt}`);
    if (delta !== 0) return delta;
    return a < b ? -1 : 1;
  })[0]!;
}
