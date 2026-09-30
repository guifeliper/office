/**
 * Round 2 workstation: r1 (2×2-grid sit, floating monitor) × r2 (matrix sit on the new
 * body, monitor on a stand), on the lodge floor, with measured checks.
 *
 *   npx vite-node scripts/paint-station-r2.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { paintCell } from '../src/renderer/office/ground-tiles';
import { paintChair, paintMonitor } from '../src/renderer/office/station-art';
import { DESK_PLACEMENTS, MONITOR_HEIGHT, MONITOR_LIFT, TILE, cellCenter, propBase, seatAnchor, seatCell } from '../src/renderer/office/world-layout';
import { INK, SIT_NORTH, paintMatrix } from './body-art';
import { lum } from './body-rubric';
import { blit, createImage, getPixel, readPng, scaleImage, setPixel, writePng, type Rgba } from './png';

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'src/renderer/office/art');
const OUT = path.join(ROOT, 'docs/design/station');

const desk = readPng(path.join(ART, 'props/desk.png'));
const chair = paintChair();
const frameOf = (sheet: Rgba, height: number) => {
  const out = createImage(16, height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < 16; x += 1) setPixel(out, x, y, getPixel(sheet, 32 + x, y));
  return out;
};
const monitorR2 = frameOf(paintMonitor(), MONITOR_HEIGHT);
const sitR2Snap = readPng(path.join(OUT, 'r2-snap-sit.png'));
const sitR2 = paintMatrix(SIT_NORTH);
writePng(path.join(OUT, 'r2-sit-north.png'), sitR2.image);

const placed = DESK_PLACEMENTS[0]!;
const base = propBase(placed);
const seat = cellCenter(seatCell(placed));
const anchor = seatAnchor(placed);
const view = { x: base.x - 40, y: base.y - 48, w: 80, h: 72 };

interface Layers { img: Rgba; desk: Rgba; chair: Rgba; monitor: Rgba; monitorTop: number }

function station(sit: Rgba, monitor: Rgba, lift: number, bodyX: number): Layers {
  const img = createImage(view.w, view.h);
  for (let y = 0; y < view.h; y += 1) for (let x = 0; x < view.w; x += 1) {
    const wx = view.x + x;
    const wy = view.y + y;
    const cell = paintCell(Math.floor(wx / TILE), Math.floor(wy / TILE));
    if (cell) setPixel(img, x, y, cell[(wy % TILE) * TILE + (wx % TILE)]!);
  }
  const layer = (src: Rgba, left: number, top: number) => {
    const out = createImage(view.w, view.h);
    blit(out, src, left - view.x, top - view.y);
    blit(img, src, left - view.x, top - view.y);
    return out;
  };
  const monitorTop = base.y - lift - monitor.height;
  const deskLayer = layer(desk, base.x - desk.width / 2, base.y - desk.height);
  const monitorLayer = layer(monitor, base.x - 8, monitorTop);
  const chairLayer = layer(chair, bodyX - 8, anchor.y - 16);
  layer(sit, bodyX - 24, anchor.y - 56);
  return { img, desk: deskLayer, chair: chairLayer, monitor: monitorLayer, monitorTop: monitorTop - view.y };
}

const r2 = station(sitR2Snap, monitorR2, MONITOR_LIFT, seat.x);
const r2b = station(sitR2.image, monitorR2, MONITOR_LIFT, anchor.x);

const gap = 8;
const sheet = createImage(2 * view.w + 3 * gap, view.h + 2 * gap);
for (let i = 0; i < sheet.width * sheet.height; i += 1) sheet.data.set([0x4a, 0x30, 0x18, 255], i * 4);
blit(sheet, r2.img, gap, gap);
blit(sheet, r2b.img, gap * 2 + view.w, gap);
writePng(path.join(OUT, 'r2b-compare-1x.png'), sheet);
writePng(path.join(OUT, 'r2b-compare-2x.png'), scaleImage(sheet, 2));

/** Sit canvas (x, y) → view coordinates. */
const off = { x: anchor.x - 24 - view.x, y: anchor.y - 56 - view.y };
const opaque = (img: Rgba, x: number, y: number) => getPixel(img, x, y) >= 0;
type Check = { value: string; pass: boolean };
const report: Record<string, Check> = {};

function monitorGap(s: Layers): number {
  let bottom = -1;
  for (let y = 0; y < view.h; y += 1) for (let x = 0; x < view.w; x += 1) if (opaque(s.monitor, x, y)) bottom = Math.max(bottom, y);
  let worst = 0;
  for (let x = 0; x < view.w; x += 1) {
    if (!opaque(s.monitor, x, bottom)) continue;
    let y = bottom + 1;
    let n = 0;
    while (y < view.h && !opaque(s.desk, x, y) && n < 40) { y += 1; n += 1; }
    worst = Math.max(worst, n);
  }
  return worst;
}
const g2 = monitorGap(r2b);
report['monitor apoiado'] = { value: `vão ${g2}px (pé sobre o tampo); cadeira x ${anchor.x} = mesa x ${base.x}`, pass: g2 === 0 && anchor.x === base.x };

const at = (x: number, y: number) => sitR2.material.get(y * 48 + x);
const toneAt = (x: number, y: number) => sitR2.tone.get(y * 48 + x);
const span = (y: number, keep: (x: number) => boolean) => {
  const xs = [...Array(48).keys()].filter(keep);
  return xs.length ? { x0: xs[0]!, x1: xs[xs.length - 1]!, n: xs.length } : null;
};

let headTop = 68;
let headBottom = -1;
for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) if (at(x, y) === 'hair') { headTop = Math.min(headTop, y); headBottom = Math.max(headBottom, y); }
const head = span(headTop + 3, (x) => at(x, headTop + 3) === 'hair')!;
const torso = span(47, (x) => x >= 19 && x <= 28 && at(x, 47) === 'shirt')!;
const headH = headBottom - headTop + 2;
report['1 proporção sentada'] = {
  value: `cabeça ${headH} linhas (y${headTop}–${headBottom + 1}, cabelo + nuca) × ${head.n} largura; tronco ${torso.n}; cabeça ≥ tronco+4: ${head.n >= torso.n + 4}`,
  pass: head.n >= torso.n + 4 && torso.n <= 11 && headH === 15,
};

let light = 0, mid = 0, dark = 0;
for (const [key, m] of sitR2.material) if (m === 'hair') {
  const t = sitR2.tone.get(key);
  if (t === 0) light += 1; else if (t === 1) mid += 1; else dark += 1;
}
let crownLight = 0;
for (let y = headTop; y < headTop + 4; y += 1) for (let x = 0; x < 48; x += 1) if (at(x, y) === 'hair' && toneAt(x, y) === 0) crownLight += 1;
const crown = crownLight >= 12 && toneAt(20, headTop) === 0;
report['2 cabelo'] = {
  value: `claro ${light} médio ${mid} escuro ${dark} (claro ${Math.round((light / (light + mid + dark)) * 100)}%), brilho na coroa ${crownLight}px tocando o topo: ${crown}`,
  pass: crown && mid > light && mid > dark && light / (light + mid + dark) < 0.3,
};

const hands: string[] = [];
let handsOk = true;
const HANDS = [
  { name: 'esquerda (teclado)', x0: 14, y0: 39, cuffY: 42, desk: true },
  { name: 'direita (coxa)', x0: 29, y0: 50, cuffY: 49, desk: false },
];
for (const hand of HANDS) {
  let skin = 0;
  let onDesk = 0;
  for (let y = hand.y0; y < hand.y0 + 3; y += 1) for (let x = hand.x0; x < hand.x0 + 3; x += 1) {
    if (at(x, y) === 'skin') skin += 1;
    if (at(x, y) === 'skin' && opaque(r2b.desk, off.x + x, off.y + y)) onDesk += 1;
  }
  const cuff = [0, 1, 2].every((d) => at(hand.x0 + d, hand.cuffY) === 'shirt' && toneAt(hand.x0 + d, hand.cuffY) === 2);
  const out = hand.x0 < 19 ? 19 - (hand.x0 + 2) : hand.x0 - 28;
  hands.push(`${hand.name} x${hand.x0}–${hand.x0 + 2} y${hand.y0}–${hand.y0 + 2} pele ${skin}/9, fora do tronco ${out}px, sobre a mesa ${onDesk}, punho escuro ${cuff}`);
  handsOk &&= skin === 9 && cuff && out >= 1 && (!hand.desk || onDesk >= 6);
}
report['4 mãos'] = { value: hands.join(' | '), pass: handsOk };

const shirtDark = new Set<number>();
for (const [key, m] of sitR2.material) if (m === 'shirt' && sitR2.tone.get(key) === 2) shirtDark.add(key);
let ribbons = 0;
for (const key of shirtDark) {
  const x = key % 48;
  const y = Math.floor(key / 48);
  const inBlock = [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) =>
    [[0, 0], [1, 0], [0, 1], [1, 1]].every(([ex, ey]) => shirtDark.has((y + dy! + ey!) * 48 + x + dx! + ex!)));
  const horizontalRun = shirtDark.has(key - 1) || shirtDark.has(key + 1);
  if (!inBlock && !horizontalRun) ribbons += 1;
}
const foldBlock = [20, 21, 22].every((x) => [48, 49, 50].every((y) => shirtDark.has(y * 48 + x)));
report['5 dobras'] = { value: `dobra das costas 3×3 x20–22 y48–50: ${foldBlock}; fitas verticais 1px ${ribbons}`, pass: foldBlock && ribbons === 0 };

let ink = 0;
for (let i = 0; i < 48 * 68; i += 1) if (getPixel(sitR2.image, i % 48, Math.floor(i / 48)) === INK) ink += 1;
report['7 sel-out'] = { value: `ink no corpo sentado ${ink} px`, pass: ink === 0 };

const WOOD = [0xe6c49a, 0xc4925a, 0x8a5a30, 0x4a3018];
const sides: number[] = [];
for (let y = 53; y <= 55; y += 1) {
  const hip = span(y, (x) => opaque(sitR2.image, x, y))!;
  for (const [from, step] of [[hip.x0 - 1, -1], [hip.x1 + 1, 1]] as const) {
    let n = 0;
    for (let x = from; WOOD.includes(getPixel(r2b.chair, off.x + x, off.y + y)); x += step) n += 1;
    sides.push(n);
  }
}
let bottom = -1;
for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) if (opaque(sitR2.image, x, y)) bottom = Math.max(bottom, y);
report['8 assento'] = {
  value: `última fileira ${bottom}, fileira 56 vazia; madeira ao lado do quadril ${sides.join(',')}`,
  pass: bottom === 55 && sides.every((n) => n >= 2),
};

let screenBottom = -1;
for (let y = 0; y < view.h; y += 1) for (let x = 0; x < view.w; x += 1) {
  const c = getPixel(r2b.monitor, x, y);
  if (c >= 0 && y < r2b.monitorTop + 12) screenBottom = Math.max(screenBottom, y);
}
const headTopView = off.y + headTop;
let overlap = 0;
for (let y = 0; y < view.h; y += 1) for (let x = 0; x < view.w; x += 1) {
  if (y < r2b.monitorTop + 12 && opaque(r2b.monitor, x, y) && opaque(sitR2.image, x - off.x, y - off.y)) overlap += 1;
}
report['9 leitura 1×'] = {
  value: `tela termina na linha ${screenBottom}, cabeça começa na ${headTopView} (folga ${headTopView - screenBottom - 1}); corpo sobre a tela ${overlap}px (o pé do suporte fica atrás da cabeça)`,
  pass: headTopView > screenBottom && overlap === 0,
};

const colors = new Set<number>();
let dirty = 0;
for (let i = 0; i < 48 * 68; i += 1) {
  const a = sitR2.image.data[i * 4 + 3]!;
  if (a !== 0 && a !== 255) dirty += 1;
  const c = getPixel(sitR2.image, i % 48, Math.floor(i / 48));
  if (c >= 0) colors.add(c);
}
const lumDrop = ['shirt', 'skin', 'pants', 'hair'].every((m) => {
  const ls = [0, 1, 2].map((t) => [...sitR2.material].find(([k, mm]) => mm === m && sitR2.tone.get(k) === t)).map((e) => (e ? lum(getPixel(sitR2.image, e[0] % 48, Math.floor(e[0] / 48))) : null));
  return ls.every((l, i) => l !== null && (i === 0 || l < ls[i - 1]!));
});
report['6+10 paleta'] = { value: `${colors.size} cores (paleta do corpo r2), alpha sujo ${dirty}, luminância cai claro→médio→escuro ${lumDrop}`, pass: colors.size <= 16 && dirty === 0 && lumDrop };

fs.writeFileSync(path.join(OUT, 'r2b-pass-fail.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const [k, v] of Object.entries(report)) console.warn(`${v.pass ? 'PASS' : 'FAIL'} ${k}: ${v.value}`);
