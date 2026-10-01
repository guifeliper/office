/**
 * One workstation, before × after, on the lodge floor. Writes the new chair prop and the
 * pass/fail of "Comparação com referência — estação de trabalho" §5.
 *
 *   npx vite-node scripts/paint-station.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { paintCell } from '../src/renderer/office/ground-tiles';
import type { Appearance } from '../src/renderer/office/paper-doll';
import { INK, SIT_NECK, SIT_PILOT, SIT_SHIRT, paintChair, paintMonitor, paintSit, sitPalette } from '../src/renderer/office/station-art';
import { DESK_PLACEMENTS, MONITOR_HEIGHT, MONITOR_LIFT, TILE, propBase, seatAnchor } from '../src/renderer/office/world-layout';
import { blit, createImage, getPixel, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'src/renderer/office/art');
const OUT = path.join(ROOT, 'docs/design/station');
fs.mkdirSync(OUT, { recursive: true });

const beforeChair = path.join(OUT, 'before-chair.png');
const beforeSit = path.join(OUT, 'before-sit-north-0.png');
if (!fs.existsSync(beforeChair)) fs.copyFileSync(path.join(ART, 'props/chair.png'), beforeChair);
if (!fs.existsSync(beforeSit) && fs.existsSync(path.join(ART, 'sit-north-0.png'))) {
  fs.copyFileSync(path.join(ART, 'sit-north-0.png'), beforeSit);
}

const chair = paintChair();
writePng(path.join(ART, 'props/chair.png'), chair);
writePng(path.join(ART, 'props/monitor.png'), paintMonitor());

const desk = readPng(path.join(ART, 'props/desk.png'));
const monitorSheet = readPng(path.join(ART, 'props/monitor.png'));
const monitor = createImage(16, MONITOR_HEIGHT);
for (let y = 0; y < MONITOR_HEIGHT; y += 1) {
  for (let x = 0; x < 16; x += 1) setPixel(monitor, x, y, getPixel(monitorSheet, 32 + x, y));
}

const placed = DESK_PLACEMENTS[0]!;
const base = propBase(placed);
const seat = seatAnchor(placed);
const view = { x: base.x - 40, y: base.y - 48, w: 80, h: 72 };
const off = { x: seat.x - 24 - view.x, y: seat.y - 56 - view.y };

interface Station { img: Rgba; chair: Rgba; desk: Rgba }

function station(chairImg: Rgba, sit: Rgba): Station {
  const img = createImage(view.w, view.h);
  for (let y = 0; y < view.h; y += 1) {
    for (let x = 0; x < view.w; x += 1) {
      const wx = view.x + x;
      const wy = view.y + y;
      const cell = paintCell(Math.floor(wx / TILE), Math.floor(wy / TILE));
      if (cell) setPixel(img, x, y, cell[(wy % TILE) * TILE + (wx % TILE)]!);
    }
  }
  const layer = (src: Rgba, left: number, top: number) => {
    const out = createImage(view.w, view.h);
    blit(out, src, left - view.x, top - view.y);
    blit(img, src, left - view.x, top - view.y);
    return out;
  };
  const deskLayer = layer(desk, base.x - desk.width / 2, base.y - desk.height);
  layer(monitor, base.x - 8, base.y - MONITOR_LIFT - MONITOR_HEIGHT);
  const chairLayer = layer(chairImg, seat.x - 8, seat.y - 16);
  layer(sit, seat.x - 24, seat.y - 56);
  return { img, chair: chairLayer, desk: deskLayer };
}

function sheet(panels: Rgba[]): Rgba {
  const gap = 8;
  const out = createImage(panels.length * (view.w + gap) + gap, view.h + gap * 2);
  for (let i = 0; i < out.width * out.height; i += 1) out.data.set([0x4a, 0x30, 0x18, 255], i * 4);
  panels.forEach((panel, i) => blit(out, panel, gap + i * (view.w + gap), gap));
  return out;
}

const lum = (c: number) => 0.2126 * ((c >>> 16) & 0xff) + 0.7152 * ((c >>> 8) & 0xff) + 0.0722 * (c & 0xff);
const WOOD = [0xe6c49a, 0xc4925a, 0x8a5a30, 0x4a3018];
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function largest(img: Rgba, keep: (c: number) => boolean, maxY = img.height, sameColor = true): { color: number; size: number; count: number } {
  const seen = new Set<number>();
  let best = { color: -1, size: 0 };
  let count = 0;
  for (let y = 0; y < maxY; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const c = getPixel(img, x, y);
      if (c < 0 || !keep(c) || seen.has(y * img.width + x)) continue;
      count += 1;
      let size = 0;
      const stack: [number, number][] = [[x, y]];
      seen.add(y * img.width + x);
      while (stack.length) {
        const [px, py] = stack.pop()!;
        size += 1;
        for (const [dx, dy] of STEPS) {
          const nx = px + dx;
          const ny = py + dy;
          const nc = getPixel(img, nx, ny);
          if (ny >= maxY || nc < 0 || !keep(nc) || (sameColor && nc !== c) || seen.has(ny * img.width + nx)) continue;
          seen.add(ny * img.width + nx);
          stack.push([nx, ny]);
        }
      }
      if (size > best.size) best = { color: c, size };
    }
  }
  return { ...best, count };
}

type Result = Record<string, boolean | number | string>;

function check(appearance: Appearance): { result: Result; panel: Rgba } {
  const sits = paintSit(appearance);
  const sit = sits[0]!;
  const after = station(chair, sit);
  const palette = sitPalette(appearance);
  const shirt = SIT_SHIRT[appearance.outfit]!;
  const shirtTones = new Set([shirt.light, shirt.main]);
  const r: Result = {};

  let neckInk = 0;
  const after2 = scaleImage(after.img, 2);
  let neckInk2 = 0;
  for (let x = SIT_NECK.x0; x <= SIT_NECK.x1; x += 1) {
    for (let y = SIT_NECK.y0 - 2; y <= SIT_NECK.y1 + 1; y += 1) {
      if (getPixel(after.img, off.x + x, off.y + y) === INK) neckInk += 1;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (getPixel(after2, (off.x + x) * 2 + dx!, (off.y + y) * 2 + dy!) === INK) neckInk2 += 1;
      }
    }
  }
  r['1x sem linha #201B0F no pescoço'] = neckInk === 0;

  const main = largest(sit, (c) => shirtTones.has(c));
  const delta = Math.min(...[0xe6c49a, 0xc4925a].map((w) => Math.abs(lum(main.color) - lum(w))));
  r['1x camisa maior cluster'] = `#${main.color.toString(16).padStart(6, '0')} ${main.size}px Δ${Math.round(delta)}`;
  r['1x camisa Δ≥40 vs madeira'] = delta >= 40;

  let dirty = 0;
  for (const frame of sits) for (let i = 3; i < frame.data.length; i += 4) if (frame.data[i] !== 0 && frame.data[i] !== 255) dirty += 1;
  r['1x alpha 0/255'] = dirty === 0;
  const allowed = new Set([...Object.values(palette), INK]);
  let foreign = 0;
  for (const frame of sits) for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) {
    const c = getPixel(frame, x, y);
    if (c >= 0 && !allowed.has(c)) foreign += 1;
  }
  r['1x paleta fechada por material'] = foreign === 0;

  const sides: number[] = [];
  for (let y = 52; y <= 54; y += 1) {
    let minX = 48;
    let maxX = -1;
    for (let x = 0; x < 48; x += 1) if (getPixel(sit, x, y) >= 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    for (const [from, step] of [[minX - 1, -1], [maxX + 1, 1]] as const) {
      let n = 0;
      for (let x = from; WOOD.includes(getPixel(after.chair, off.x + x, off.y + y)); x += step) n += 1;
      sides.push(n);
    }
  }
  r['1x madeira opaca dos 2 lados do quadril'] = `${sides.join(',')} → ${sides.every((n) => n >= 2) ? 'ok' : 'falha'}`;

  let overDesk = 0;
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) {
    if (shirtTones.has(getPixel(sit, x, y)) && getPixel(after.desk, off.x + x, off.y + y) >= 0) overDesk += 1;
  }
  r['1x ≥4 px de camisa sobre a borda sul da mesa'] = `${overDesk} → ${overDesk >= 4 ? 'ok' : 'falha'}`;

  r['2x pescoço sem tinta'] = neckInk2 === 0;
  const hair = new Set([palette.g, palette.H, palette.h, palette.C, palette.c, palette.L]);
  const heads = largest(sit, (c) => hair.has(c), SIT_NECK.y0, false);
  r['2x uma cabeça só'] = heads.count === 1;

  let bad = 0;
  for (const frame of sits) for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) {
    const c = getPixel(frame, x, y);
    if (c < 0 || c === INK) continue;
    const ok = [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) =>
      [[0, 0], [1, 0], [0, 1], [1, 1]].every(([ex, ey]) => getPixel(frame, x + dx! + ex!, y + dy! + ey!) === c));
    if (!ok) bad += 1;
  }
  r['2x cluster mínimo 2×2 fora do contorno (4 frames)'] = bad === 0;

  let bottom = -1;
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) if (getPixel(sit, x, y) >= 0) bottom = Math.max(bottom, y);
  const seatUnder = WOOD.includes(getPixel(after.chair, off.x + 17, off.y + 55));
  r['2x fileira 56 encosta no assento'] = bottom === 55 && seatUnder;

  let minX = 48, minY = 68, maxX = -1, maxY = -1;
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) if (getPixel(sit, x, y) >= 0) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  r['caixa opaca'] = `x${minX}–${maxX} y${minY}–${maxY} (${maxX - minX + 1}×${maxY - minY + 1})`;
  return { result: r, panel: after.img };
}

const pilot = check(SIT_PILOT);
const before = station(readPng(beforeChair), readPng(beforeSit));
paintSit(SIT_PILOT).forEach((frame, index) => writePng(path.join(OUT, `sit-north-${index}.png`), frame));
const compare = sheet([before.img, pilot.panel]);
writePng(path.join(OUT, 'compare-1x.png'), compare);
writePng(path.join(OUT, 'compare-2x.png'), scaleImage(compare, 2));

const VARIANTS: Appearance[] = [
  { skin: 1, hair: 3, hairShape: 1, outfit: 0, hat: 0, accessory: 2 },
  { skin: 3, hair: 1, hairShape: 2, outfit: 1, hat: 1, accessory: 0 },
  { skin: 4, hair: 4, hairShape: 0, outfit: 3, hat: 3, accessory: 0 },
  { skin: 2, hair: 2, hairShape: 0, outfit: 2, hat: 2, accessory: 1 },
];
const variants = VARIANTS.map(check);
const variantSheet = sheet(variants.map((v) => v.panel));
writePng(path.join(OUT, 'variants-1x.png'), variantSheet);
writePng(path.join(OUT, 'variants-2x.png'), scaleImage(variantSheet, 2));

const report = { pilot: pilot.result, variants: variants.map((v, i) => ({ appearance: VARIANTS[i], ...v.result })) };
fs.writeFileSync(path.join(OUT, 'pass-fail.json'), `${JSON.stringify(report, null, 2)}\n`);
const fails = [pilot, ...variants].flatMap((v, i) =>
  Object.entries(v.result).filter(([, val]) => val === false || (typeof val === 'string' && val.endsWith('falha'))).map(([k]) => `${i}:${k}`));
console.warn(JSON.stringify(pilot.result, null, 2));
console.warn(fails.length ? `FAIL ${fails.join(' | ')}` : 'ALL PASS (pilot + 4 variants)');
