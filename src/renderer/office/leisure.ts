import { COFFEE_CELLS, HEARTH_CHAIR_CELLS } from './cabin-layout';

export type LeisureKind = 'hearth' | 'coffee' | 'woodpile' | 'garden';
export type LeisureFacing = 'south' | 'north' | 'east' | 'west';
export type Zone = 'yard' | 'cabin';

/** Overflow order. The yard campfire is scenery now; nobody paths to it. */
export const LEISURE_KINDS: readonly LeisureKind[] = ['hearth', 'coffee', 'woodpile', 'garden'];

export const LEISURE_ZONE: Record<LeisureKind, Zone> = {
  hearth: 'cabin',
  coffee: 'cabin',
  woodpile: 'yard',
  garden: 'yard',
};

/** Hearth seats use the chair; the others stand. */
export const LEISURE_SEATED: Record<LeisureKind, boolean> = {
  hearth: true,
  coffee: false,
  woodpile: false,
  garden: false,
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
  { kind: 'woodpile', col: 14, row: 24, facing: 'north' },
  { kind: 'woodpile', col: 18, row: 24, facing: 'north' },
  { kind: 'garden', col: 17, row: 35, facing: 'south' },
  { kind: 'garden', col: 17, row: 36, facing: 'south' },
  { kind: 'garden', col: 17, row: 39, facing: 'south' },
];

export const LEISURE_CAPACITY: Record<LeisureKind, number> = {
  hearth: 4,
  coffee: 2,
  woodpile: 2,
  garden: 3,
};

/** First free slot in the preferred activity; if that is full, the next kind. */
export function assignLeisure(id: string, taken: ReadonlySet<string>): LeisureDef {
  const start = LEISURE_KINDS.indexOf(preferredLeisureKind(id));
  for (let offset = 0; offset < LEISURE_KINDS.length; offset += 1) {
    const kind = LEISURE_KINDS[(start + offset) % LEISURE_KINDS.length]!;
    const free = LEISURE_DEFS.find((def) => def.kind === kind && !taken.has(leisureKey(def)));
    if (free) return free;
  }
  const pool = LEISURE_DEFS.filter((def) => def.kind === preferredLeisureKind(id));
  return pool[hash(id) % pool.length]!;
}

export const LEISURE_HOLD_MS = 900;
export const LEISURE_STEP_MS: Record<LeisureKind, number> = {
  hearth: 1000,
  coffee: 320,
  woodpile: 120,
  garden: 160,
};

/** Pack frame counts: sit is one still, idle 4, axe 6, hoe 6. */
export const LEISURE_FRAMES: Record<LeisureKind, number> = {
  hearth: 1,
  coffee: 4,
  woodpile: 6,
  garden: 6,
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
