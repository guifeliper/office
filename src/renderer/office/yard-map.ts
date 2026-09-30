import { parse } from 'yaml';

/** Bump this when the document shape changes. Version 1 is the current contract. */
export const YARD_MAP_VERSION = 1;

export interface YardEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface YardDisk {
  cx: number;
  cy: number;
  r: number;
}

export interface YardCell {
  col: number;
  row: number;
}

export interface YardLodge {
  left: number;
  right: number;
  top: number;
  bottom: number;
  doorCols: readonly [number, ...number[]];
}

export interface YardNorthFace {
  row: number;
  left: number;
  right: number;
  gapLeft: number;
  gapRight: number;
}

export interface YardGarden {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A prop row is a cell, or a token resolved after the coast exists (`gate-3`, `south-1`, `lodge`). */
export type YardPropRow = number | string;

export interface YardProp {
  kind: string;
  col: number;
  row: YardPropRow;
}

export interface YardMap {
  version: number;
  island: YardEllipse;
  lodge: YardLodge;
  paths: readonly (readonly [number, number, number, number])[];
  plaza: YardDisk;
  peninsulas: readonly YardEllipse[];
  bays: readonly YardDisk[];
  islets: readonly YardCell[];
  terraces: readonly YardEllipse[];
  northFace: YardNorthFace;
  garden: YardGarden;
  gateCols: readonly [number, number, ...number[]];
  props: readonly YardProp[];
}

const TOP_KEYS = [
  'version',
  'island',
  'lodge',
  'paths',
  'plaza',
  'peninsulas',
  'bays',
  'islets',
  'terraces',
  'northFace',
  'garden',
  'gateCols',
  'props',
] as const;

const ROW_TOKEN = /^(gate|south|lodge)([+-]\d+)?$/;

/**
 * Parse and validate the yard map document.
 * `kinds` is the prop vocabulary the renderer knows (collision stays in code).
 */
export function parseYardMap(text: string, kinds: readonly string[]): YardMap {
  const raw = parse(text);
  const doc = record(raw, 'document');
  exactKeys(doc, TOP_KEYS, 'document');

  const version = finite(doc.version, 'version');
  if (version !== YARD_MAP_VERSION) {
    throw new Error(`yard-map: unsupported version ${version}`);
  }

  const known = new Set(kinds);
  return {
    version,
    island: ellipse(doc.island, 'island'),
    lodge: lodge(doc.lodge),
    paths: paths(doc.paths),
    plaza: disk(doc.plaza, 'plaza'),
    peninsulas: list(doc.peninsulas, 'peninsulas', (item, index) => ellipse(item, `peninsulas[${index}]`)),
    bays: list(doc.bays, 'bays', (item, index) => disk(item, `bays[${index}]`)),
    islets: list(doc.islets, 'islets', (item, index) => cell(item, `islets[${index}]`)),
    terraces: list(doc.terraces, 'terraces', (item, index) => ellipse(item, `terraces[${index}]`)),
    northFace: northFace(doc.northFace),
    garden: garden(doc.garden),
    gateCols: gateCols(doc.gateCols),
    props: list(doc.props, 'props', (item, index) => prop(item, `props[${index}]`, known)),
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`yard-map: ${label} must be a map`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const known = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw new Error(`yard-map: ${label} has unknown field "${key}"`);
  }
  for (const key of keys) {
    if (!(key in value)) throw new Error(`yard-map: ${label} is missing "${key}"`);
  }
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`yard-map: ${label} must be a finite number`);
  }
  return value;
}

function integer(value: unknown, label: string): number {
  const n = finite(value, label);
  if (!Number.isInteger(n)) throw new Error(`yard-map: ${label} must be an integer`);
  return n;
}

function ellipse(value: unknown, label: string): YardEllipse {
  const doc = record(value, label);
  exactKeys(doc, ['cx', 'cy', 'rx', 'ry'], label);
  const rx = finite(doc.rx, `${label}.rx`);
  const ry = finite(doc.ry, `${label}.ry`);
  if (rx <= 0 || ry <= 0) throw new Error(`yard-map: ${label} radii must be positive`);
  return { cx: finite(doc.cx, `${label}.cx`), cy: finite(doc.cy, `${label}.cy`), rx, ry };
}

function disk(value: unknown, label: string): YardDisk {
  const doc = record(value, label);
  exactKeys(doc, ['cx', 'cy', 'r'], label);
  const r = finite(doc.r, `${label}.r`);
  if (r <= 0) throw new Error(`yard-map: ${label}.r must be positive`);
  return { cx: finite(doc.cx, `${label}.cx`), cy: finite(doc.cy, `${label}.cy`), r };
}

function cell(value: unknown, label: string): YardCell {
  const doc = record(value, label);
  exactKeys(doc, ['col', 'row'], label);
  return { col: integer(doc.col, `${label}.col`), row: integer(doc.row, `${label}.row`) };
}

function lodge(value: unknown): YardLodge {
  const doc = record(value, 'lodge');
  exactKeys(doc, ['left', 'right', 'top', 'bottom', 'doorCols'], 'lodge');
  const doorCols = intList(doc.doorCols, 'lodge.doorCols');
  if (doorCols.length < 1) throw new Error('yard-map: lodge.doorCols must not be empty');
  return {
    left: integer(doc.left, 'lodge.left'),
    right: integer(doc.right, 'lodge.right'),
    top: integer(doc.top, 'lodge.top'),
    bottom: integer(doc.bottom, 'lodge.bottom'),
    doorCols: doorCols as unknown as readonly [number, ...number[]],
  };
}

function northFace(value: unknown): YardNorthFace {
  const doc = record(value, 'northFace');
  exactKeys(doc, ['row', 'left', 'right', 'gapLeft', 'gapRight'], 'northFace');
  return {
    row: integer(doc.row, 'northFace.row'),
    left: integer(doc.left, 'northFace.left'),
    right: integer(doc.right, 'northFace.right'),
    gapLeft: integer(doc.gapLeft, 'northFace.gapLeft'),
    gapRight: integer(doc.gapRight, 'northFace.gapRight'),
  };
}

function garden(value: unknown): YardGarden {
  const doc = record(value, 'garden');
  exactKeys(doc, ['left', 'right', 'top', 'bottom'], 'garden');
  return {
    left: integer(doc.left, 'garden.left'),
    right: integer(doc.right, 'garden.right'),
    top: integer(doc.top, 'garden.top'),
    bottom: integer(doc.bottom, 'garden.bottom'),
  };
}

function paths(value: unknown): readonly (readonly [number, number, number, number])[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('yard-map: paths must be a non-empty list');
  }
  return value.map((item, index) => {
    if (!Array.isArray(item) || item.length !== 4) {
      throw new Error(`yard-map: paths[${index}] must be [x0, y0, x1, y1]`);
    }
    const coords = item.map((n, i) => finite(n, `paths[${index}][${i}]`));
    return [coords[0]!, coords[1]!, coords[2]!, coords[3]!] as const;
  });
}

function gateCols(value: unknown): readonly [number, number, ...number[]] {
  const cols = intList(value, 'gateCols');
  if (cols.length < 2) throw new Error('yard-map: gateCols needs the two passage cells');
  return cols as unknown as readonly [number, number, ...number[]];
}

function intList(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) throw new Error(`yard-map: ${label} must be a list`);
  return value.map((item, index) => integer(item, `${label}[${index}]`));
}

function list<T>(value: unknown, label: string, map: (item: unknown, index: number) => T): readonly T[] {
  if (!Array.isArray(value)) throw new Error(`yard-map: ${label} must be a list`);
  return value.map(map);
}

function prop(value: unknown, label: string, kinds: ReadonlySet<string>): YardProp {
  const doc = record(value, label);
  exactKeys(doc, ['kind', 'col', 'row'], label);
  if (typeof doc.kind !== 'string' || !kinds.has(doc.kind)) {
    throw new Error(`yard-map: ${label}.kind is not a known prop`);
  }
  const col = integer(doc.col, `${label}.col`);
  const row = propRow(doc.row, `${label}.row`);
  return { kind: doc.kind, col, row };
}

function propRow(value: unknown, label: string): YardPropRow {
  if (typeof value === 'number') return integer(value, label);
  if (typeof value === 'string' && ROW_TOKEN.test(value)) return value;
  throw new Error(`yard-map: ${label} must be a cell or gate/south/lodge offset`);
}
