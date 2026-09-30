import { describe, expect, it } from 'vitest';
import { cliffFootAt, darkEdgeMask, grassTileAt } from '../../src/renderer/office/ground-tiles';
import {
  COLS,
  PROPS,
  ROWS,
  propFootprint,
  terrainAt,
  type PropPlacement,
} from '../../src/renderer/office/world-layout';

const SCATTER = new Set(['flower', 'mushroom', 'butterfly', 'rock', 'shoreRock']);

function key(col: number, row: number): string {
  return `${col},${row}`;
}

function footprintKeys(placement: PropPlacement): string[] {
  return propFootprint(placement).map((cell) => key(cell.col, cell.row));
}

describe('map placement', () => {
  it('closes every dark-grass edge onto a mass and leaves no orphan', () => {
    let edges = 0;
    const mass = (col: number, row: number) => grassTileAt(col, row) === 'grass-1';
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (grassTileAt(c, r) === 'grass-dark') expect(darkEdgeMask(c, r)).toBeNull();
        const mask = darkEdgeMask(c, r);
        if (mask === null) continue;
        edges += 1;
        const neighbours = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dc, dr]) => mass(c + dc!, r + dr!));
        expect(neighbours.length, `${c},${r}`).toBeGreaterThan(0);
        if (mask & 8) expect(mass(c, r + 1), `${c},${r} north edge`).toBe(true);
        if (mask & 4) expect(mass(c - 1, r), `${c},${r} east edge`).toBe(true);
        if (mask & 2) expect(mass(c, r - 1), `${c},${r} south edge`).toBe(true);
        if (mask & 1) expect(mass(c + 1, r), `${c},${r} west edge`).toBe(true);
      }
    }
    expect(edges).toBeGreaterThan(0);
  });

  it('keeps scatter off trees, bushes, and every other prop', () => {
    const solid = new Set<string>();
    for (const prop of PROPS) {
      if (SCATTER.has(prop.kind)) continue;
      for (const cell of footprintKeys(prop)) solid.add(cell);
    }
    const scatter = new Set<string>();
    for (const prop of PROPS) {
      if (!SCATTER.has(prop.kind)) continue;
      for (const cell of footprintKeys(prop)) {
        expect(solid.has(cell), `${prop.kind} overlaps a prop at ${cell}`).toBe(false);
        expect(scatter.has(cell), `${prop.kind} overlaps another scatter at ${cell}`).toBe(false);
        scatter.add(cell);
      }
    }
  });

  it('places a few butterflies far apart', () => {
    const butterflies = PROPS.filter((prop) => prop.kind === 'butterfly');
    expect(butterflies.length).toBeGreaterThan(0);
    expect(butterflies.length).toBeLessThanOrEqual(5);
    for (let i = 0; i < butterflies.length; i += 1) {
      for (let j = i + 1; j < butterflies.length; j += 1) {
        const a = butterflies[i]!;
        const b = butterflies[j]!;
        expect(Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('keeps small flower and mushroom accents sparse', () => {
    const accents = PROPS.filter((prop) => prop.kind === 'flower' || prop.kind === 'mushroom');
    expect(accents.length).toBeGreaterThan(20);
    expect(accents.length).toBeLessThanOrEqual(48);
  });

  it('keeps the pier and any dock over water at the shore, clear of other props', () => {
    const docks = PROPS.filter((prop) => prop.kind === 'pier' || prop.kind === 'bridge');
    expect(docks.length).toBeGreaterThan(0);
    const others = new Set(PROPS.filter((prop) => prop.kind !== 'pier' && prop.kind !== 'bridge').flatMap(footprintKeys));
    for (const dock of docks) {
      const cells = propFootprint(dock);
      let wet = 0;
      let shore = false;
      for (const cell of cells) {
        const ground = terrainAt(cell.col, cell.row);
        const beside = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dc, dr]) => terrainAt(cell.col + dc!, cell.row + dr!));
        const land = beside.some((kind) => kind === 'grass' || kind === 'sand' || kind === 'path');
        if (ground === 'water') wet += 1;
        else expect(land, `${dock.kind} ${cell.col},${cell.row}`).toBe(true);
        if (land) shore = true;
        expect(others.has(key(cell.col, cell.row)), `${dock.kind} ${cell.col},${cell.row}`).toBe(false);
      }
      expect(wet).toBeGreaterThan(0);
      expect(shore).toBe(true);
    }
  });

  it('puts the cliff foot on water with water to its south', () => {
    let feet = 0;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (!cliffFootAt(c, r)) continue;
        feet += 1;
        expect(terrainAt(c, r)).toBe('water');
        const south = terrainAt(c, r + 1);
        expect(south === 'water' || south === 'void').toBe(true);
      }
    }
    expect(feet).toBeGreaterThan(0);
  });
});
