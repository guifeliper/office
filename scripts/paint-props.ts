/**
 * Paints the map-pass props as exact pixel data on the closed ramp of
 * `docs/design/art-direction-map-pass.md`, and quantizes the older cut props onto it.
 *
 *   npx vite-node scripts/paint-props.ts
 *
 * Originals are kept once in `docs/design/props-original/` before any overwrite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAMP } from '../src/renderer/office/ground-tiles';
import { paintChair, paintMonitor } from '../src/renderer/office/station-art';
import { createImage, getPixel, readPng, setPixel, stats, writePng, type Rgba } from './png';

const ROOT = path.resolve(__dirname, '..');
const PROPS = path.join(ROOT, 'src/renderer/office/art/props');
const BACKUP = path.join(ROOT, 'docs/design/props-original');

interface Blob {
  x: number;
  y: number;
  r: number;
}

interface Foliage {
  light: number;
  body: number;
  shadow: number;
  deep: number;
}

const STONE: Foliage = { light: RAMP.stoneLight, body: RAMP.stone, shadow: RAMP.stoneDark, deep: RAMP.stoneDark };

/**
 * Lumpy mass on a half-resolution grid, so every color lands as a 2×2 cluster.
 * Blobs are listed back (north) to front (south); a cell belongs to the last blob that
 * holds it. Light on each lump's north rim, shadow on its south, deep pocket where a
 * back lump meets the lump in front of it.
 */
function paintMass(
  img: Rgba,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  blobs: Blob[],
  pal: Foliage,
  /** Small masses: light only on the outer top rim, or the whole thing turns pale. */
  rimOnly = false,
): number[][] {
  const owner: number[][] = [];
  for (let j = 0; j < rows; j += 1) {
    owner.push([]);
    for (let i = 0; i < cols; i += 1) {
      let o = -1;
      blobs.forEach((b, k) => {
        if ((i + 0.5 - b.x) ** 2 + (j + 0.5 - b.y) ** 2 <= b.r * b.r) o = k;
      });
      owner[j]!.push(o);
    }
  }
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= cols || j >= rows ? -1 : owner[j]![i]!);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const o = at(i, j);
      if (o < 0) continue;
      const b = blobs[o]!;
      const local = (j + 0.5 - b.y) / b.r;
      const up = at(i, j - 1);
      const down = at(i, j + 1);
      let color = pal.body;
      if (down > o) color = pal.deep;
      else if (down < 0 || local > 0.45) color = pal.shadow;
      else if (rimOnly ? up < 0 && local < 0 : local < -0.55 || (local < 0 && up < o)) color = pal.light;
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) setPixel(img, ox + i * 2 + dx, oy + j * 2 + dy, color);
    }
  }
  return owner;
}

/** 1 px ink on the outer silhouette only. `skipTop` leaves the top open (trunk under canopy). */
function outline(img: Rgba, skipAbove = -1): void {
  const marks: [number, number][] = [];
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (getPixel(img, x, y) >= 0 || y < skipAbove) continue;
      const n = [getPixel(img, x + 1, y), getPixel(img, x - 1, y), getPixel(img, x, y + 1), getPixel(img, x, y - 1)];
      if (n.some((c) => c >= 0 && c !== RAMP.ink)) marks.push([x, y]);
    }
  }
  for (const [x, y] of marks) setPixel(img, x, y, RAMP.ink);
}

function rect(img: Rgba, x: number, y: number, w: number, h: number, color: number): void {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) setPixel(img, xx, yy, color);
}

type LobeBox = { x: number; y: number; w: number; h: number; flower?: boolean };

/** Five lobes, 10×8–14×10, with a transparent gap of at least 2 px between them. Variant 1 mirrors. Variant 2 swaps the north lobe for a blossom. */
function crownBoxes(variant: 0 | 1 | 2): LobeBox[] {
  const base: LobeBox[] = [
    { x: 24, y: 0, w: 14, h: 9 },
    { x: 8, y: 11, w: 14, h: 10 },
    { x: 38, y: 12, w: 12, h: 9 },
    { x: 24, y: 11, w: 12, h: 8 },
    { x: 22, y: 21, w: 14, h: 10 },
  ];
  if (variant === 1) return base.map((b) => ({ ...b, x: 64 - b.x - b.w }));
  if (variant === 2) return [{ x: 29, y: 2, w: 4, h: 4, flower: true }, ...base.slice(1)];
  return base;
}

/**
 * Notched crown. Five separate lobes. No fill between them, no sel-out.
 * North of a lobe is sun and light; the south 3 px is that lobe's own shadow.
 */
function paintCrown(grid: number[][], variant: 0 | 1 | 2): void {
  const h = grid.length;
  const w = grid[0]!.length;
  for (const lobe of crownBoxes(variant)) {
    if (lobe.flower) {
      for (let dy = 0; dy < lobe.h; dy += 1) {
        for (let dx = 0; dx < lobe.w; dx += 1) {
          const px = lobe.x + dx;
          const py = lobe.y + dy;
          if (py < 0 || px < 0 || py >= h || px >= w) continue;
          grid[py]![px] = dy < 2 ? RAMP.pathLight : RAMP.gold;
        }
      }
      continue;
    }
    for (let dy = 0; dy < lobe.h; dy += 1) {
      for (let dx = 0; dx < lobe.w; dx += 1) {
        const px = lobe.x + dx;
        const py = lobe.y + dy;
        if (py < 0 || px < 0 || py >= h || px >= w) continue;
        const nx = ((dx + 0.5) / lobe.w) * 2 - 1;
        const ny = ((dy + 0.5) / lobe.h) * 2 - 1;
        if (nx * nx + ny * ny > 1) continue;
        grid[py]![px] = RAMP.grassDeep;
      }
    }
    let capX = 0;
    let capY = 0;
    let placed = false;
    for (let dy = 0; dy <= lobe.h - 3 && !placed; dy += 1) {
      for (let dx = 0; dx <= lobe.w - 4 && !placed; dx += 1) {
        let fits = true;
        for (let yy = 0; yy < 3 && fits; yy += 1) {
          for (let xx = 0; xx < 4; xx += 1) {
            const py = lobe.y + dy + yy;
            const px = lobe.x + dx + xx;
            if (grid[py]![px] !== RAMP.grassDeep) fits = false;
          }
        }
        if (!fits) continue;
        capX = dx;
        capY = dy;
        placed = true;
      }
    }
    if (!placed) continue;
    for (let yy = 0; yy < 3; yy += 1) {
      for (let xx = 0; xx < 4; xx += 1) grid[lobe.y + capY + yy]![lobe.x + capX + xx] = RAMP.grassSun;
    }
  }
}

/** Sel-out. North edge may meet transparency in the light; every other edge is the deep green. */
function selOut(img: Rgba, light: number, dark: number): void {
  const marks: [number, number, number][] = [];
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (getPixel(img, x, y) < 0) continue;
      const north = getPixel(img, x, y - 1) < 0;
      const south = getPixel(img, x, y + 1) < 0;
      const west = getPixel(img, x - 1, y) < 0;
      const east = getPixel(img, x + 1, y) < 0;
      if (!north && !south && !west && !east) continue;
      marks.push([x, y, north && !south && !west && !east ? light : dark]);
    }
  }
  for (const [x, y, color] of marks) setPixel(img, x, y, color);
}

function emptyGrid(w: number, h: number): number[][] {
  return Array.from({ length: h }, () => Array<number>(w).fill(-1));
}

/** Translate so the opaque box is centered and its last row sits on the canvas bottom. */
function gridToImage(grid: number[][]): Rgba {
  const h = grid.length;
  const w = grid[0]!.length;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (grid[y]![x]! < 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const dx = Math.floor((w - (maxX - minX + 1)) / 2) - minX;
  const dy = h - 1 - maxY;
  const img = createImage(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const color = grid[y]![x]!;
      if (color < 0) continue;
      setPixel(img, x + dx, y + dy, color);
    }
  }
  return img;
}

function foliageMasses(img: Rgba): { x: number; y: number; w: number; h: number }[] {
  const seen = new Uint8Array(img.width * img.height);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const start = y * img.width + x;
      if (seen[start] || getPixel(img, x, y) < 0) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack: [number, number][] = [[x, y]];
      seen[start] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
          const ni = ny * img.width + nx;
          if (seen[ni] || getPixel(img, nx, ny) < 0) continue;
          seen[ni] = 1;
          stack.push([nx, ny]);
        }
      }
      out.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    }
  }
  return out;
}

function assertCanopy(name: string, img: Rgba): void {
  const s = stats(img);
  const masses = foliageMasses(img);
  const big = masses.filter((m) => m.w >= 6 && m.h >= 6);
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  let light = 0;
  let deep = 0;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const c = getPixel(img, x, y);
      if (c < 0) continue;
      opaque += 1;
      if (c === RAMP.grassSun || c === RAMP.grassLight || c === RAMP.pathLight) light += 1;
      if (c === RAMP.grassDeep) deep += 1;
      if (c === RAMP.ink || c === RAMP.grass) throw new Error(`${name} uses ink or lawn green`);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const share = opaque ? light / opaque : 0;
  const deepShare = opaque ? deep / opaque : 0;
  if (s.loose || !s.alphaClean || big.length < 4 || bw < 40 || bh < 28 || share > 0.2 || deepShare < 0.6) {
    throw new Error(`${name} loose=${s.loose} big=${big.length} box=${bw}x${bh} light=${share.toFixed(2)} deep=${deepShare.toFixed(2)} masses=${masses.map((m) => `${m.w}x${m.h}`).join(',')}`);
  }
  let top = 0;
  let mid = 0;
  const midY = minY + Math.floor(bh / 2);
  for (let x = 0; x < img.width; x += 1) {
    if (getPixel(img, x, minY) >= 0) top += 1;
    if (getPixel(img, x, midY) >= 0) mid += 1;
  }
  if (mid < top + 6) throw new Error(`${name} silhouette is flat (top ${top} mid ${mid})`);
}

/** 0 and 1 share the leaf ramp. 2 swaps the bud for blossoms and drops the deep pocket. */
function weldSprite(img: Rgba): void {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= img.width || y >= img.height ? -2 : getPixel(img, x, y));
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        const color = at(x, y);
        if (color < 0) continue;
        const neighbors = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].filter((v) => v >= 0);
        if (!neighbors.length || neighbors.includes(color)) continue;
        const counts = new Map<number, number>();
        for (const neighbor of neighbors) counts.set(neighbor, (counts.get(neighbor) ?? 0) + 1);
        const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        if (!top || top[0] === color) continue;
        setPixel(img, x, y, top[0]);
        changed = true;
      }
    }
    if (!changed) return;
  }
}

/** Drop 1 px spikes. A pixel with a single neighbor reads as a loose leaf. */
function trimTips(img: Rgba): void {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= img.width || y >= img.height ? -1 : getPixel(img, x, y));
  for (let pass = 0; pass < 3; pass += 1) {
    const drop: [number, number][] = [];
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        if (at(x, y) < 0) continue;
        let n = 0;
        if (at(x + 1, y) >= 0) n += 1;
        if (at(x - 1, y) >= 0) n += 1;
        if (at(x, y + 1) >= 0) n += 1;
        if (at(x, y - 1) >= 0) n += 1;
        if (n < 2) drop.push([x, y]);
      }
    }
    if (!drop.length) return;
    for (const [x, y] of drop) setPixel(img, x, y, -1);
  }
}

function canopy(variant: 0 | 1 | 2): Rgba {
  const grid = emptyGrid(64, 48);
  paintCrown(grid, variant);
  const img = gridToImage(grid);
  trimTips(img);
  weldSprite(img);
  assertCanopy(`canopy-${variant}`, img);
  return img;
}

/**
 * 32×24. Opaque rows 6–23 stay 18 px so the canopy line does not move.
 * Three bark tones, roots, contact shadow in grass. No ink ring.
 */
function trunk(): Rgba {
  const img = createImage(32, 24);
  rect(img, 12, 6, 8, 12, RAMP.wood);
  rect(img, 12, 6, 8, 2, RAMP.woodLight);
  rect(img, 12, 8, 2, 8, RAMP.woodLight);
  rect(img, 18, 8, 2, 10, RAMP.woodDark);
  rect(img, 15, 11, 2, 2, RAMP.woodDark);
  rect(img, 8, 16, 6, 2, RAMP.wood);
  rect(img, 6, 18, 6, 2, RAMP.woodDark);
  rect(img, 4, 20, 4, 2, RAMP.woodDark);
  rect(img, 18, 16, 6, 2, RAMP.woodDark);
  rect(img, 22, 18, 4, 2, RAMP.woodDark);
  rect(img, 24, 20, 4, 2, RAMP.woodDark);
  rect(img, 4, 22, 24, 2, RAMP.grassDark);
  return img;
}

/** One shrub: three clumps, each broken into 4 px leaves. Variant 1 shifts the lobes. */
function bush(variant: 0 | 1): Rgba {
  const grid = emptyGrid(24, 16);
  const lobes: Lobe[] = variant === 0
    ? [{ x: 6, y: 5, rx: 6, ry: 4 }, { x: 16, y: 5, rx: 6, ry: 4 }, { x: 11, y: 10, rx: 7, ry: 4 }]
    : [{ x: 7, y: 6, rx: 6, ry: 4 }, { x: 17, y: 4, rx: 5, ry: 4 }, { x: 12, y: 11, rx: 7, ry: 4 }];
  const mask: boolean[][] = [];
  for (let y = 0; y < 16; y += 1) {
    mask.push([]);
    for (let x = 0; x < 24; x += 1) {
      let on = false;
      for (const lobe of lobes) {
        const nx = (x - lobe.x) / lobe.rx;
        const ny = (y - lobe.y) / lobe.ry;
        if (nx * nx + ny * ny <= 1) on = true;
      }
      mask[y]!.push(on);
    }
  }
  const clumps: [number, number, number, number][] = variant === 0
    ? [[1, 2, 8, 6], [15, 2, 8, 6], [6, 8, 12, 5]]
    : [[2, 2, 8, 6], [15, 3, 7, 5], [5, 8, 12, 5]];
  for (const [x, y, cw, ch] of clumps) {
    for (let dy = 0; dy < ch; dy += 1) {
      for (let dx = 0; dx < cw; dx += 1) {
        const px = x + dx;
        const py = y + dy;
        if (py < 0 || px < 0 || py >= 16 || px >= 24 || !mask[py]![px]) continue;
        if ((dx === 0 || dx === cw - 1) && (dy === 0 || dy === ch - 1)) continue;
        let color = RAMP.grassLight;
        if (dx < 3 && dy < 2) color = RAMP.grassSun;
        else if (dy >= ch - 2) color = RAMP.grassDeep;
        else if (dx >= cw - 2) color = RAMP.grassDark;
        grid[py]![px] = color;
      }
    }
  }
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 24; x += 1) {
      if (mask[y]![x] && grid[y]![x]! < 0) grid[y]![x] = RAMP.grassDark;
    }
  }
  const valley = variant === 0 ? 10 : 11;
  for (let y = 1; y < 5; y += 1) for (let x = valley; x < valley + 3; x += 1) grid[y]![x] = -1;
  const img = gridToImage(grid);
  trimTips(img);
  selOut(img, RAMP.grassLight, RAMP.grassDeep);
  weldSprite(img);
  const s = stats(img);
  const masses = foliageMasses(img).filter((m) => m.w >= 6 && m.h >= 6);
  if (s.loose || !s.alphaClean || masses.length !== 1) {
    throw new Error(`bush-${variant} loose=${s.loose} masses=${masses.length}`);
  }
  return img;
}

/** Three 4×4 flowers. Canvas 24×16, drawing 20×12. */
function flowerTuft(): Rgba {
  const img = createImage(24, 16);
  rect(img, 2, 2, 20, 12, RAMP.ink);
  rect(img, 3, 3, 18, 4, RAMP.grassLight);
  rect(img, 3, 7, 18, 4, RAMP.grass);
  rect(img, 3, 11, 18, 2, RAMP.grassDark);
  for (const x of [4, 10, 16]) {
    rect(img, x, 4, 4, 2, RAMP.pathLight);
    rect(img, x, 6, 4, 2, RAMP.gold);
  }
  return img;
}

function shoreRock(): Rgba {
  const img = createImage(16, 16);
  paintMass(img, 3, 7, 5, 4, [
    { x: 2.5, y: 2.4, r: 2.5 },
  ], STONE);
  outline(img);
  return img;
}

/** Quantize stays on the pre-round-5 ramp so old props do not pick up the new tones. */
const PALETTE = [
  RAMP.grassLight, RAMP.grass, RAMP.grassDark, RAMP.grassDeep,
  RAMP.pathLight, RAMP.path, RAMP.pathDark,
  RAMP.waterLight, RAMP.water, RAMP.waterDark,
  RAMP.stoneLight, RAMP.stone, RAMP.stoneDark,
  RAMP.woodLight, RAMP.wood, RAMP.woodDark, RAMP.woodDeep,
  RAMP.gold, RAMP.ink,
];

function nearest(r: number, g: number, b: number): number {
  let best = PALETTE[0]!;
  let bestD = Infinity;
  for (const c of PALETTE) {
    const dr = r - ((c >>> 16) & 0xff);
    const dg = g - ((c >>> 8) & 0xff);
    const db = b - (c & 0xff);
    const d = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Snap every opaque pixel to the ramp, then fold lone pixels into their neighborhood. */
function quantize(src: Rgba): Rgba {
  const img = createImage(src.width, src.height);
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const o = (y * src.width + x) * 4;
      if (src.data[o + 3]! < 128) continue;
      setPixel(img, x, y, nearest(src.data[o]!, src.data[o + 1]!, src.data[o + 2]!));
    }
  }
  for (let pass = 0; pass < 3; pass += 1) {
    const edits: [number, number, number][] = [];
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        const c = getPixel(img, x, y);
        if (c < 0) continue;
        const four = [getPixel(img, x + 1, y), getPixel(img, x - 1, y), getPixel(img, x, y + 1), getPixel(img, x, y - 1)];
        if (four.includes(c)) continue;
        const counts = new Map<number, number>();
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const n = getPixel(img, x + dx, y + dy);
            // A diagonal twin would re-elect the lone pixel; only other colors vote.
            if (n !== c) counts.set(n, (counts.get(n) ?? 0) + 1);
          }
        }
        const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        edits.push([x, y, top![0]]);
      }
    }
    for (const [x, y, c] of edits) setPixel(img, x, y, c);
  }
  return img;
}

function downscaleNearest(src: Rgba, height: number): Rgba {
  const width = Math.round((src.width * height) / src.height);
  const img = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor(((x + 0.5) * src.width) / width));
      const sy = Math.min(src.height - 1, Math.floor(((y + 0.5) * src.height) / height));
      const o = (sy * src.width + sx) * 4;
      img.data.set(src.data.subarray(o, o + 4), (y * width + x) * 4);
    }
  }
  return img;
}

function backup(file: string): void {
  const from = path.join(PROPS, file);
  const to = path.join(BACKUP, file);
  if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to);
}

fs.mkdirSync(BACKUP, { recursive: true });

/**
 * Desk only. Canvas 48×24, drawing 32×16 flushed to the bottom so the anchor
 * is the south edge. The monitor and the chair are their own sprites.
 */
function desk(): Rgba {
  const img = createImage(48, 24);
  rect(img, 8, 8, 32, 16, RAMP.ink);
  rect(img, 9, 9, 30, 4, RAMP.woodLight);
  rect(img, 9, 13, 30, 1, RAMP.wood);
  rect(img, 9, 14, 30, 6, RAMP.woodDark);
  rect(img, 10, 20, 4, 4, RAMP.woodDeep);
  rect(img, 34, 20, 4, 4, RAMP.woodDeep);
  // 4×2 support where the monitor sprite sits.
  rect(img, 22, 9, 4, 2, RAMP.wood);
  return img;
}

/** Shared with the runtime proof in `scripts/paint-station.ts`. */
function chair(): Rgba {
  return paintChair();
}

/**
 * Lodge roof, 352×32. Shingle rows on both slopes, eave in the deep wood.
 * Sel-out: the outer pixels are wood, not ink.
 */
/**
 * Two roof planes, not a stack of stripes. North slope is the lit wood,
 * south slope is the shade, eave is the deep lip. Shingle caps are short.
 */
function lodgeRoof(): Rgba {
  const img = createImage(352, 32);
  const row = (y: number, light: number, body: number, shade: number, offset: number) => {
    const w = 14;
    for (let x = -w + offset; x < 352; x += w) {
      const x0 = Math.max(0, x);
      const x1 = Math.min(352, x + w - 2);
      if (x1 > x0) {
        rect(img, x0, y, x1 - x0, 2, light);
        rect(img, x0, y + 2, x1 - x0, 3, body);
        rect(img, x0, y + 5, x1 - x0, 1, shade);
      }
      const gx = Math.max(0, x + w - 2);
      if (gx < 352) rect(img, gx, y, Math.min(2, 352 - gx), 6, RAMP.woodDeep);
    }
  };
  row(0, RAMP.woodLight, RAMP.wood, RAMP.woodDark, 0);
  row(6, RAMP.woodLight, RAMP.wood, RAMP.woodDark, 7);
  rect(img, 0, 12, 352, 3, RAMP.woodLight);
  rect(img, 0, 14, 352, 1, RAMP.woodDark);
  row(15, RAMP.wood, RAMP.woodDark, RAMP.woodDeep, 0);
  row(21, RAMP.wood, RAMP.woodDark, RAMP.woodDeep, 7);
  rect(img, 0, 27, 352, 5, RAMP.woodDeep);
  return img;
}

/** Canvas 32×16, opaque 32×14. Posts in three woods; rails carry a shadow lip. No ink. */
function fence(): Rgba {
  const img = createImage(32, 16);
  const oy = 2;
  const rail = (y: number) => {
    rect(img, 2, oy + y, 28, 1, RAMP.woodLight);
    rect(img, 2, oy + y + 1, 28, 2, RAMP.wood);
    rect(img, 2, oy + y + 3, 28, 1, RAMP.woodDark);
  };
  const post = (x: number) => {
    rect(img, x, oy, 4, 2, RAMP.woodLight);
    rect(img, x, oy + 2, 2, 8, RAMP.wood);
    rect(img, x + 2, oy + 2, 2, 8, RAMP.woodDark);
    rect(img, x, oy + 10, 4, 4, RAMP.woodDark);
  };
  rail(1);
  rail(8);
  post(0);
  post(28);
  return img;
}

/** Canvas 24×16, opaque 20×14. Three logs, north face light, cut ends dark. */
function woodpile(): Rgba {
  const img = createImage(24, 16);
  const log = (x: number, y: number, w: number) => {
    rect(img, x, y, w, 5, RAMP.ink);
    rect(img, x + 1, y + 1, w - 2, 1, RAMP.woodLight);
    rect(img, x + 1, y + 2, w - 2, 1, RAMP.wood);
    rect(img, x + 1, y + 3, w - 2, 1, RAMP.woodDark);
  };
  log(4, 2, 16);
  log(2, 6, 20);
  log(4, 11, 16);
  rect(img, 5, 4, 2, 2, RAMP.woodDeep);
  rect(img, 16, 8, 2, 2, RAMP.woodDeep);
  return img;
}

/** Canvas 48×32. Top 36×18, net 2 px, opaque height 22. Wood frame so it reads on grass. */
function pingpong(): Rgba {
  const img = createImage(48, 32);
  rect(img, 6, 10, 36, 18, RAMP.ink);
  rect(img, 7, 11, 34, 16, RAMP.wood);
  rect(img, 9, 13, 30, 12, RAMP.grassDark);
  rect(img, 11, 18, 12, 2, RAMP.pathLight);
  rect(img, 25, 18, 12, 2, RAMP.pathLight);
  rect(img, 23, 13, 2, 12, RAMP.ink);
  for (const x of [8, 36]) {
    rect(img, x, 24, 4, 8, RAMP.ink);
    rect(img, x + 1, 25, 2, 6, RAMP.woodDeep);
  }
  return img;
}

/** Canvas 48×32, opaque 48×24 flush to the bottom. Dark soil, six tufts. */
function gardenBed(): Rgba {
  const img = createImage(48, 32);
  rect(img, 0, 8, 48, 24, RAMP.ink);
  rect(img, 1, 9, 46, 22, RAMP.woodDeep);
  rect(img, 2, 10, 44, 3, RAMP.woodDark);
  const spots = [
    [5, 15], [20, 15], [35, 15],
    [5, 23], [20, 23], [35, 23],
  ] as const;
  spots.forEach(([x, y], i) => {
    rect(img, x, y, 8, 2, RAMP.grassLight);
    rect(img, x, y + 2, 8, 3, RAMP.grass);
    rect(img, x + 2, y + 5, 4, 2, RAMP.grassDark);
    if (i === 1 || i === 4) {
      rect(img, x + 2, y, 2, 2, RAMP.pathLight);
      rect(img, x + 4, y, 2, 2, RAMP.gold);
    }
  });
  return img;
}

/**
 * Seated north pose from the pilot still. Top 28 opaque rows, 17 wide, on the
 * 48×68 canvas with the foot anchor still on row 56. Odd frames drop the side
 * columns 1px — the hands leave the keyboard. No new colors.
 */
function paintSitNorth(dir: string): void {
  const src = readPng(path.join(dir, 'north.png'));
  let minX = src.width;
  let minY = src.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      if (getPixel(src, x, y) < 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const cropW = Math.min(17, maxX - minX + 1);
  const cropH = 28;
  const srcX = minX;
  const dstX = Math.round((48 - cropW) / 2);
  const dstY = 28;
  console.log(`sit source bbox ${minX},${minY} ${maxX - minX + 1}×${maxY - minY + 1} crop x=${srcX}`);
  for (let frame = 0; frame < 4; frame += 1) {
    const img = createImage(48, 68);
    for (let y = 0; y < cropH; y += 1) {
      for (let x = 0; x < cropW; x += 1) {
        const color = getPixel(src, srcX + x, minY + y);
        if (color < 0) continue;
        const drop = frame % 2 === 1 && (x < 4 || x >= cropW - 4) && y >= 8 && y < 20 ? 1 : 0;
        setPixel(img, dstX + x, dstY + y + drop, color);
      }
    }
    writePng(path.join(dir, `sit-north-${frame}.png`), img);
  }
}

function copyImage(src: Rgba): Rgba {
  const img = createImage(src.width, src.height);
  img.data.set(src.data);
  return img;
}

function opaqueBox(img: Rgba): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = img.width;
  let minY = img.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (getPixel(img, x, y) < 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Idle poses from the pilot stills. Pilot colors, not the ground ramp. */
function paintLeisurePoses(dir: string): void {
  const north = readPng(path.join(dir, 'north.png'));
  const south = readPng(path.join(dir, 'south.png'));

  for (let frame = 0; frame < 4; frame += 1) {
    const img = copyImage(readPng(path.join(dir, `sit-north-${frame}.png`)));
    const box = opaqueBox(img);
    const reach = frame === 1 || frame === 3 ? 2 : 0;
    if (reach) {
      for (let y = box.minY + 10; y < box.minY + 18; y += 1) {
        for (let x = box.maxX - 3; x <= box.maxX; x += 1) {
          const color = getPixel(img, x, y);
          if (color >= 0) setPixel(img, x, y - reach, color);
        }
      }
    }
    writePng(path.join(dir, `leisure-fire-${frame}.png`), img);
  }

  const handleX = () => opaqueBox(north).maxX + 1;
  const tops = [34, 26, 20, 38];
  const heights = [14, 18, 16, 10];
  for (let frame = 0; frame < 4; frame += 1) {
    const img = copyImage(north);
    const x = handleX();
    const y = tops[frame]!;
    const h = heights[frame]!;
    rect(img, x, y, 2, h, 0x4a3018);
    rect(img, x, y, 2, 2, 0x8a5a30);
    if (frame >= 2) {
      rect(img, x - 1, y, 4, 3, 0x5e564e);
      rect(img, x, y, 2, 2, 0xa3988c);
    }
    writePng(path.join(dir, `leisure-axe-${frame}.png`), img);
  }

  const sb = opaqueBox(south);
  for (let frame = 0; frame < 3; frame += 1) {
    const img = createImage(48, 68);
    const drop = 8;
    for (let y = sb.minY; y <= sb.minY + 30; y += 1) {
      for (let x = sb.minX; x <= sb.maxX; x += 1) {
        const color = getPixel(south, x, y);
        if (color >= 0) setPixel(img, x, y + drop, color);
      }
    }
    const canX = sb.maxX + 1;
    const canY = sb.minY + 18 + drop + (frame === 1 ? 1 : 0);
    rect(img, canX, canY, 4, 6, 0x4a7c9b);
    rect(img, canX, canY, 4, 2, 0x8a5a30);
    if (frame > 0) {
      rect(img, canX + 1, canY + 6, 2, 2, 0x7aabca);
      if (frame === 2) rect(img, canX + 1, canY + 8, 2, 2, 0x4a7c9b);
    }
    writePng(path.join(dir, `leisure-garden-${frame}.png`), img);
  }
}

function paintCampfireFrames(): void {
  const base = readPng(path.join(PROPS, 'campfire.png'));
  const box = opaqueBox(base);
  const cx = Math.round((box.minX + box.maxX) / 2);
  const top = box.minY + 2;
  for (let frame = 0; frame < 4; frame += 1) {
    const img = copyImage(base);
    const lift = frame % 2;
    rect(img, cx - 2, top - lift, 5, 2, RAMP.gold);
    rect(img, cx - 1, top + 1, 3, 2 + lift, RAMP.woodLight);
    if (frame >= 2) rect(img, cx, top - 1 - lift, 2, 2, RAMP.gold);
    writePng(path.join(PROPS, `campfire-${frame}.png`), img);
  }
}

const painted: Record<string, Rgba> = {
  'tree-canopy.png': canopy(0),
  'tree-canopy-b.png': canopy(1),
  'tree-canopy-c.png': canopy(2),
  'tree-trunk.png': trunk(),
  'bush.png': bush(0),
  'bush-b.png': bush(1),
  'flower-tuft.png': flowerTuft(),
  'shore-rock.png': shoreRock(),
  'desk.png': desk(),
  'monitor.png': paintMonitor(),
  'chair.png': chair(),
  'lodge-roof.png': lodgeRoof(),
  'fence.png': fence(),
  'woodpile.png': woodpile(),
  'pingpong.png': pingpong(),
  'garden-bed.png': gardenBed(),
};

const QUANTIZE = [
  'meeting-table.png', 'campfire.png', 'stump-axe.png',
  'gate-left.png', 'gate-right.png', 'gatehouse-base.png', 'gatehouse-lintel.png',
  'lodge-door.png', 'rock.png',
];

const PACK_TREES = new Set(['tree-canopy.png', 'tree-canopy-b.png', 'tree-canopy-c.png', 'tree-trunk.png']);

for (const [file, img] of Object.entries(painted)) {
  if (PACK_TREES.has(file)) continue;
  backup(file);
  writePng(path.join(PROPS, file), img);
}
for (const file of QUANTIZE) {
  backup(file);
  let src = readPng(path.join(BACKUP, file));
  if (file === 'lodge-door.png') src = downscaleNearest(src, 40);
  writePng(path.join(PROPS, file), quantize(src));
}

/** Character frames are painted from the matrix in `src/renderer/office/cast.ts`. */
void paintSitNorth;
void paintLeisurePoses;
void paintCampfireFrames;

for (const file of [...Object.keys(painted), ...QUANTIZE]) {
  if (PACK_TREES.has(file)) continue;
  const s = stats(readPng(path.join(PROPS, file)));
  const box = s.opaqueBox ? `${s.opaqueBox.w}×${s.opaqueBox.h}` : '-';
  console.log(`${file.padEnd(22)} colors=${String(s.colors).padStart(3)} alpha=${s.alphaClean ? 'ok' : 'DIRTY'} drawn=${box.padEnd(6)} loose=${s.loose}`);
}
