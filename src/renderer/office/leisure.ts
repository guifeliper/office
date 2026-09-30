import { COFFEE_CELLS, HEARTH_CHAIR_CELLS } from './cabin-layout';

export type LeisureKind = 'hearth' | 'coffee' | 'woodpile' | 'garden' | 'fishing';
export type LeisureFacing = 'south' | 'north' | 'east' | 'west';
export type Zone = 'yard' | 'cabin';

/** Overflow order. The yard campfire is scenery now; nobody paths to it. */
export const LEISURE_KINDS: readonly LeisureKind[] = ['hearth', 'coffee', 'woodpile', 'garden', 'fishing'];

export const LEISURE_ZONE: Record<LeisureKind, Zone> = {
  hearth: 'cabin',
  coffee: 'cabin',
  woodpile: 'yard',
  garden: 'yard',
  fishing: 'yard',
};

/** Hearth seats use the chair; the others stand. */
export const LEISURE_SEATED: Record<LeisureKind, boolean> = {
  hearth: true,
  coffee: false,
  woodpile: false,
  garden: false,
  fishing: false,
};

export interface LeisureDef {
  kind: LeisureKind;
  col: number;
  row: number;
  facing: LeisureFacing;
}

export function leisureKey(def: LeisureDef): string {
  return `${def.kind}:${def.col},${def.row}`;
}

/**
 * Conversation key from a consultant id (`source:conversation`).
 * Same conversation prefers the same activity.
 */
export function conversationKey(id: string): string {
  const cut = id.indexOf(':');
  return cut >= 0 ? id.slice(cut + 1) : id;
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function preferredLeisureKind(id: string): LeisureKind {
  return LEISURE_KINDS[hash(conversationKey(id)) % LEISURE_KINDS.length]!;
}

/**
 * Cabin: four chairs facing the fireplace, two spots at the coffee counter.
 * Yard: two at the stump / pile, facing north; three in the garden aisle, facing the beds.
 * Cabin cells are on the cabin grid; yard cells on the yard grid.
 */
export const LEISURE_DEFS: readonly LeisureDef[] = [
  ...HEARTH_CHAIR_CELLS.map((c) => ({ kind: 'hearth' as const, ...c, facing: 'north' as const })),
  ...COFFEE_CELLS.map((c) => ({ kind: 'coffee' as const, ...c, facing: 'north' as const })),
  { kind: 'woodpile', col: 16, row: 29, facing: 'north' },
  { kind: 'woodpile', col: 18, row: 29, facing: 'north' },
  { kind: 'garden', col: 20, row: 37, facing: 'south' },
  { kind: 'garden', col: 20, row: 38, facing: 'south' },
  { kind: 'garden', col: 20, row: 41, facing: 'north' },
  // Last land cells beside the pier (31, 52). They face the water.
  { kind: 'fishing', col: 30, row: 51, facing: 'south' },
  { kind: 'fishing', col: 32, row: 51, facing: 'south' },
];

export const LEISURE_CAPACITY: Record<LeisureKind, number> = {
  hearth: 4,
  coffee: 2,
  woodpile: 2,
  garden: 3,
  fishing: 2,
};

/**
 * First free named slot in the preferred activity; if that kind is full, the next kind.
 * Null when every named slot is taken. There is no standing-grid fallback.
 */
export function assignLeisure(
  id: string,
  taken: ReadonlySet<string>,
  fits: (def: LeisureDef) => boolean = () => true,
): LeisureDef | null {
  const start = LEISURE_KINDS.indexOf(preferredLeisureKind(id));
  for (let offset = 0; offset < LEISURE_KINDS.length; offset += 1) {
    const kind = LEISURE_KINDS[(start + offset) % LEISURE_KINDS.length]!;
    const free = LEISURE_DEFS.find((def) => def.kind === kind && !slotTaken(def, taken) && fits(def));
    if (free) return free;
  }
  return null;
}

function slotTaken(def: LeisureDef, taken: ReadonlySet<string>): boolean {
  return taken.has(leisureKey(def)) || taken.has(cellKey(def));
}

/** Zone and cell, so two activities cannot stand on the same floor tile. */
export function cellKey(def: Pick<LeisureDef, 'kind' | 'col' | 'row'>): string {
  return `${LEISURE_ZONE[def.kind]}:${def.col},${def.row}`;
}

export const LEISURE_HOLD_MS = 900;
export const LEISURE_STEP_MS: Record<LeisureKind, number> = {
  hearth: 1000,
  coffee: 320,
  woodpile: 120,
  garden: 160,
  fishing: 280,
};

/** Pack frame counts: sit is one still, idle 4, axe 6, hoe 6. Fishing uses its own cycle. */
export const LEISURE_FRAMES: Record<LeisureKind, number> = {
  hearth: 1,
  coffee: 4,
  woodpile: 6,
  garden: 6,
  fishing: 4,
};

/**
 * Which frame to show. Woodpile holds frame 0 after the swing so it is not noise.
 * Reduced motion and stale pass play=false and stay on 0.
 */
export function leisureFrameIndex(kind: LeisureKind, elapsedMs: number, play: boolean): number {
  if (!play) return 0;
  const step = LEISURE_STEP_MS[kind];
  const count = LEISURE_FRAMES[kind];
  if (kind === 'woodpile') {
    const cycle = count * step + LEISURE_HOLD_MS;
    const t = ((elapsedMs % cycle) + cycle) % cycle;
    if (t >= count * step) return 0;
    return Math.floor(t / step);
  }
  return Math.floor(elapsedMs / step) % count;
}
