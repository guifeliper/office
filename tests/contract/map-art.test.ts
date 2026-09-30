import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { YARD_GROUND } from '../../.cache/tiny-farm/tiles/yard-ground';
import { pathTileAt, RAMP, grassTileAt, groundDecalAt, inTrunkShade, paintCell } from '../../src/renderer/office/ground-tiles';
import { NAV } from '../../src/renderer/office/landmarks';
import {
  BUSHES,
  COLS,
  cliffRunAt,
  elevationAt,
  LODGE,
  PROPS,
  ROWS,
  TREES,
  pathDistance,
  terrainAt,
} from '../../src/renderer/office/world-layout';
import { readPng, stats } from '../../scripts/png';

/** Pass/fail from docs/design/art-direction-map-pass.md, measured on pixels, not by eye. */

const RAMP_SET = new Set<number>(Object.values(RAMP));
const LIGHT_GRASS = 0x7ec433;
const DARK_GRASS = 0x54b033;

function sameTile(px: Int32Array, tile: Int32Array): boolean {
  if (px.length !== tile.length) return false;
  for (let i = 0; i < px.length; i += 1) if (px[i] !== tile[i]) return false;
  return true;
}

function eachCell(fn: (col: number, row: number, px: Int32Array) => void): void {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const px = paintCell(c, r);
      if (px) fn(c, r, px);
    }
  }
}

describe('ground tiles', () => {
  it('stamps pack water; the cottage sits on grass and the path, not a painted roof', () => {
    expect(sameTile(paintCell(4, 4)!, YARD_GROUND.water)).toBe(true);
    let cliffs = 0;
    eachCell((c, r, px) => {
      if (terrainAt(c, r) !== 'water') return;
      const cliff = cliffRunAt(c, r) || cliffRunAt(c, r - 1) || cliffRunAt(c, r - 2);
      if (!cliff) {
        const decal = groundDecalAt(c, r);
        const want = YARD_GROUND.water.map((color, i) => (decal && decal[i]! >= 0 ? decal[i]! : color));
        expect(sameTile(px, want), `${c},${r}`).toBe(true);
        return;
      }
      cliffs += 1;
      expect(sameTile(px, YARD_GROUND.water), `${c},${r}`).toBe(false);
      for (const color of px) {
        if (color < 0) continue;
        const red = (color >>> 16) & 255;
        const green = (color >>> 8) & 255;
        const blue = color & 255;
        expect(red + green + blue, `${c},${r}`).toBeGreaterThan(24);
      }
    });
    expect(cliffs).toBeGreaterThan(10);
    expect(terrainAt(LODGE.left + 1, LODGE.top + 1)).toBe('grass');
    expect(terrainAt(LODGE.doorCols[0], LODGE.bottom)).toBe('path');
    const under = paintCell(LODGE.left + 1, LODGE.top + 1)!;
    expect(sameTile(under, YARD_GROUND.roof) || sameTile(under, YARD_GROUND['roof-b'])).toBe(false);
    expect(sameTile(paintCell(LODGE.doorCols[0], LODGE.bottom)!, YARD_GROUND.step)).toBe(false);
  });

  it('blends two grass tones through the dark autotile, banks open water, and darkens terrace tops', () => {
    let dark = 0;
    let banks = 0;
    let speckles = 0;
    let fringes = 0;
    let decals = 0;
    let terraceDark = 0;
    const bank = (c: number, r: number) => {
      const beside = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
      return beside.some(([dc, dr]) => {
        const nc = c + dc!;
        const nr = r + dr!;
        if (terrainAt(nc, nr) === 'void') return true;
        if (terrainAt(nc, nr) !== 'water') return false;
        return !cliffRunAt(nc, nr) && !cliffRunAt(nc, nr - 1) && !cliffRunAt(nc, nr - 2);
      });
    };
    eachCell((c, r, px) => {
      if (terrainAt(c, r) !== 'grass') return;
      const tile = grassTileAt(c, r);
      if (tile === 'grass-dark') {
        expect(inTrunkShade(c, r)).toBe(true);
        expect(TREES.some((t) => t.row < r && Math.abs(t.col - c) <= 2)).toBe(true);
        dark += 1;
      }
      if (elevationAt(c, r) === 2 && tile !== 'grass-0') terraceDark += 1;
      if (bank(c, r)) {
        expect(new Set(px).size, `${c},${r}`).toBeGreaterThan(1);
        for (const color of px) {
          const red = (color >>> 16) & 255;
          const green = (color >>> 8) & 255;
          const blue = color & 255;
          expect(red + green + blue, `${c},${r}`).toBeGreaterThan(24);
        }
        banks += 1;
        return;
      }
      if (groundDecalAt(c, r)) {
        decals += 1;
        return;
      }
      const base = tile === 'grass-0' ? LIGHT_GRASS : DARK_GRASS;
      if (new Set(px).size === 1) expect(px[0], `${c},${r}`).toBe(base);
      else if (tile === 'grass-0') speckles += 1;
      else {
        expect(px.includes(DARK_GRASS) && px.includes(LIGHT_GRASS), `${c},${r}`).toBe(true);
        fringes += 1;
      }
    });
    expect(dark).toBeGreaterThan(10);
    expect(banks).toBeGreaterThan(20);
    expect(terraceDark).toBeGreaterThan(20);
    expect(speckles).toBe(0);
    expect(fringes).toBeGreaterThan(20);
    expect(decals).toBeGreaterThan(20);
  });

  it('breaks the path slab: outside edges carry the light-grass fringe, the center does not', () => {
    let interior = 0;
    let rim = 0;
    let inner = 0;
    eachCell((c, r, px) => {
      if (terrainAt(c, r) !== 'path') return;
      const name = pathTileAt(c, r);
      const outside = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dc, dr]) => terrainAt(c + dc!, r + dr!) !== 'path');
      if (name === 'path-center') {
        expect(outside, `${c},${r}`).toBe(false);
        expect(px.includes(LIGHT_GRASS)).toBe(false);
        interior += 1;
      } else if (name.startsWith('path-in-')) {
        expect(outside).toBe(false);
        expect(px.includes(LIGHT_GRASS), name).toBe(true);
        inner += 1;
      } else {
        expect(outside, `${name} ${c},${r}`).toBe(true);
        expect(px.includes(LIGHT_GRASS), `${name} ${c},${r}`).toBe(true);
        rim += 1;
      }
    });
    expect(interior).toBeGreaterThan(0);
    expect(rim).toBeGreaterThan(0);
    expect(inner).toBeGreaterThan(0);
  });
});

describe('field density', () => {
  it('fills the rim with ~28 trees and the gaps with non-blocking bushes', () => {
    expect(TREES.length).toBeGreaterThanOrEqual(24);
    expect(TREES.length).toBeLessThanOrEqual(32);
    expect(BUSHES.length).toBeGreaterThanOrEqual(24);
    expect(BUSHES.length).toBeLessThanOrEqual(48);
    let onTheStep = 0;
    for (const bush of BUSHES) {
      expect(terrainAt(bush.col, bush.row)).toBe('grass');
      expect(NAV.walkable(bush.col, bush.row)).toBe(true);
      expect(pathDistance(bush.col, bush.row)).toBeGreaterThan(2.2);
      const onWater = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dc, dr]) => terrainAt(bush.col + dc!, bush.row + dr!) === 'water');
      if (onWater) onTheStep += 1;
    }
    expect(onTheStep).toBeGreaterThanOrEqual(12);
    expect(PROPS.some((p) => (p.kind as string) === 'flowerTuft' || (p.kind as string) === 'pingpong')).toBe(false);
  });

  it('floats lilies on open water, never on the cliff face', () => {
    const lilies = PROPS.filter((p) => p.kind === 'lily');
    expect(lilies.length).toBeGreaterThan(0);
    for (const lily of lilies) {
      expect(terrainAt(lily.col, lily.row), `${lily.col},${lily.row}`).toBe('water');
      const cliff = [0, 1, 2].some((up) => cliffRunAt(lily.col, lily.row - up));
      expect(cliff, `${lily.col},${lily.row}`).toBe(false);
    }
  });

  it('keeps scatter off paths, the lodge, and the gate corridor', () => {
    for (const p of PROPS.filter((q) => ['tree', 'bush', 'shoreRock'].includes(q.kind))) {
      expect(terrainAt(p.col, p.row), `${p.kind} at ${p.col},${p.row}`).toBe('grass');
    }
  });
});

describe('prop sprites', () => {
  const dir = path.resolve(__dirname, '../../src/renderer/office/art/props');
  const pine = path.resolve(__dirname, '../../.cache/tiny-farm/props');
  const limits: Record<string, number> = {
    'bush.png': 5,
    'bush-b.png': 5,
    'shore-rock.png': 4,
    'lodge-roof.png': 5,
    'monitor.png': 7,
  };
  const files = [
    'bush.png', 'bush-b.png', 'flower-tuft.png', 'shore-rock.png',
    'desk.png', 'monitor.png', 'chair.png', 'lodge-roof.png',
    'meeting-table.png', 'campfire.png', 'stump-axe.png', 'woodpile.png', 'pingpong.png',
    'garden-bed.png', 'gate-left.png', 'gate-right.png', 'gatehouse-base.png', 'gatehouse-lintel.png',
    'lodge-door.png', 'fence.png', 'rock.png',
  ];

  it.each(files)('%s: clean alpha, ramp colors only, within the color cap', (file) => {
    const img = readPng(path.join(dir, file));
    const s = stats(img);
    expect(s.alphaClean).toBe(true);
    expect(s.colors).toBeLessThanOrEqual(limits[file] ?? 16);
    expect(s.loose).toBe(0);
    for (let i = 0; i < img.width * img.height; i += 1) {
      if (img.data[i * 4 + 3] === 0) continue;
      const c = (img.data[i * 4]! << 16) | (img.data[i * 4 + 1]! << 8) | img.data[i * 4 + 2]!;
      expect(RAMP_SET.has(c)).toBe(true);
      if (file.startsWith('bush')) expect(c).not.toBe(RAMP.ink);
    }
  });

  it('matches the pilot scale: pine split at 18px, bush knee-high, door ≤ 40', () => {
    const box = (file: string) => stats(readPng(path.join(file.startsWith('tree-') ? pine : dir, file))).opaqueBox!;
    const canopy = box('tree-canopy.png');
    expect(canopy).toMatchObject({ w: 33, h: 27 });
    expect(canopy.w).toBeGreaterThan(canopy.h);
    expect(box('tree-trunk.png')).toMatchObject({ w: 34, h: 18 });
    const bushBox = box('bush.png');
    expect(bushBox.w).toBeGreaterThanOrEqual(18);
    expect(bushBox.h).toBeGreaterThanOrEqual(12);
    expect(bushBox.h).toBeLessThanOrEqual(16);
    expect(box('lodge-door.png').h).toBeLessThanOrEqual(40);
    expect(box('desk.png')).toMatchObject({ w: 32, h: 16 });
    expect(box('chair.png')).toMatchObject({ w: 16, h: 14 });
    expect(box('monitor.png')).toMatchObject({ w: 64, h: 20 });
    expect(box('lodge-roof.png')).toMatchObject({ w: 352, h: 32 });
    expect(box('fence.png')).toMatchObject({ w: 32, h: 14 });
    expect(box('woodpile.png')).toMatchObject({ w: 20, h: 14 });
    expect(box('pingpong.png')).toMatchObject({ w: 36, h: 22 });
    expect(box('garden-bed.png')).toMatchObject({ w: 48, h: 24 });
  });

  it('pine canopy is one mass and the trunk sprite is the lower 18px', () => {
    const img = readPng(path.join(pine, 'tree-canopy.png'));
    const seen = new Uint8Array(img.width * img.height);
    const opaque = (x: number, y: number) => img.data[(y * img.width + x) * 4 + 3] !== 0;
    let opaqueCount = 0;
    let biggest = 0;
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        const start = y * img.width + x;
        if (!opaque(x, y)) continue;
        opaqueCount += 1;
        if (seen[start]) continue;
        let size = 0;
        const stack: [number, number][] = [[x, y]];
        seen[start] = 1;
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          size += 1;
          for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
            if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
            const ni = ny * img.width + nx;
            if (seen[ni] || !opaque(nx, ny)) continue;
            seen[ni] = 1;
            stack.push([nx, ny]);
          }
        }
        biggest = Math.max(biggest, size);
      }
    }
    expect(opaqueCount).toBeGreaterThan(0);
    expect(biggest / opaqueCount).toBeGreaterThan(0.95);
    const trunk = readPng(path.join(pine, 'tree-trunk.png'));
    expect(trunk.height).toBe(18);
    expect(stats(trunk).alphaClean).toBe(true);
    expect(stats(img).alphaClean).toBe(true);
  });

  it('desk top is lighter than the lodge floor and the screen is the off-sky tone', () => {
    const img = readPng(path.join(dir, 'desk.png'));
    const colors = new Set<number>();
    for (let i = 0; i < img.width * img.height; i += 1) {
      if (img.data[i * 4 + 3] === 0) continue;
      colors.add((img.data[i * 4]! << 16) | (img.data[i * 4 + 1]! << 8) | img.data[i * 4 + 2]!);
    }
    expect(colors.has(RAMP.woodLight)).toBe(true);
    expect(colors.has(RAMP.waterDark)).toBe(false);
    expect(colors.has(RAMP.ink)).toBe(true);
  });
});
