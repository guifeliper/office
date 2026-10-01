/**
 * Production rubric, "Revisão rodada 1 — independente" §Rubrica de produção.
 * Each item returns the measured value and pass. Item 9 (1× reading) also needs the eye.
 */
import { INK, PALETTE, type Material, type Painted } from './body-art';
import { getPixel, type Rgba } from './png';

export type Facing = 'south' | 'north' | 'east' | 'west';
export interface Item { value: string; pass: boolean }

const W = 48;
const H = 68;
const STEPS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export const lum = (c: number) => 0.2126 * ((c >>> 16) & 0xff) + 0.7152 * ((c >>> 8) & 0xff) + 0.0722 * (c & 0xff);
const bMinusR = (c: number) => (c & 0xff) - ((c >>> 16) & 0xff);

type Pt = [number, number];

function components(points: Pt[]): Pt[][] {
  const left = new Set(points.map(([x, y]) => y * W + x));
  const out: Pt[][] = [];
  for (const [sx, sy] of points) {
    if (!left.has(sy * W + sx)) continue;
    const comp: Pt[] = [];
    const stack: Pt[] = [[sx, sy]];
    left.delete(sy * W + sx);
    while (stack.length) {
      const [x, y] = stack.pop()!;
      comp.push([x, y]);
      for (const [dx, dy] of STEPS4) {
        const k = (y + dy) * W + x + dx;
        if (!left.has(k)) continue;
        left.delete(k);
        stack.push([x + dx, y + dy]);
      }
    }
    out.push(comp);
  }
  return out;
}

function box(points: Pt[]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function hasBlock(points: Pt[], w: number, h: number): boolean {
  const set = new Set(points.map(([x, y]) => y * W + x));
  return points.some(([x, y]) => {
    for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) if (!set.has((y + dy) * W + x + dx)) return false;
    return true;
  });
}

export function rubric(
  p: Painted,
  facing: Facing,
  extra: { pilot: Rgba; composites: { grass: Rgba; path: Rgba; shadowTop: number[]; shadowBottom: number[] }; refColors: Set<number>; readsAt1x: boolean | null },
): Record<string, Item> {
  const img = p.image;
  const out: Record<string, Item> = {};
  const opaque = (x: number, y: number) => getPixel(img, x, y) >= 0;
  const mat = (x: number, y: number) => p.material.get(y * W + x);
  const tone = (x: number, y: number) => p.tone.get(y * W + x);
  const pts = (m: Material, t?: number): Pt[] => {
    const list: Pt[] = [];
    for (const [k, mm] of p.material) if (mm === m && (t === undefined || p.tone.get(k) === t)) list.push([k % W, Math.floor(k / W)]);
    return list;
  };
  const rowSpan = (y: number, keep: (x: number) => boolean = (x) => opaque(x, y)) => {
    let a = W, b = -1;
    for (let x = 0; x < W; x += 1) if (keep(x)) { a = Math.min(a, x); b = Math.max(b, x); }
    return b < 0 ? 0 : b - a + 1;
  };

  // 1 proportion
  let minY = H, maxY = -1, minX = W, maxX = -1;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (opaque(x, y)) {
    minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  }
  const height = maxY - minY + 1;
  const firstShirt = Math.min(...pts('shirt').map(([, y]) => y));
  const torsoW = rowSpan(firstShirt, (x) => mat(x, firstShirt) === 'shirt');
  let neckTop = firstShirt;
  while (neckTop - 1 > minY) {
    const y = neckTop - 1;
    let allSkin = true;
    for (let x = 0; x < W; x += 1) if (opaque(x, y) && mat(x, y) !== 'skin') allSkin = false;
    if (!allSkin || rowSpan(y) >= torsoW) break;
    neckTop = y;
  }
  const headH = neckTop - minY;
  let headW = 0;
  for (let y = minY; y < neckTop; y += 1) headW = Math.max(headW, rowSpan(y));
  const ratio = headH / height;
  out['1 proporção'] = {
    value: `altura ${height} (y${minY}–${maxY}), cabeça ${headH} (${ratio.toFixed(3)}), pescoço ${firstShirt - neckTop}, cabeça ${headW} × tronco ${torsoW}`,
    pass: height === 32 && minY === 24 && ratio >= 0.44 && ratio <= 0.52 && headW >= torsoW + 4 && torsoW <= 11,
  };

  // 2 hair mass and highlight
  const hair = pts('hair');
  const hairTop = Math.min(...hair.map(([, y]) => y));
  const lightParts = components(pts('hair', 0));
  const crown = lightParts.length === 1 ? lightParts[0] : undefined;
  const cb = crown ? box(crown) : undefined;
  const crownBox = cb && cb.x1 - cb.x0 + 1 === 4 && cb.y1 - cb.y0 + 1 === 3 && crown!.length === 12 && cb.y0 === hairTop;
  const crownAt = cb && (facing === 'east' || facing === 'west' || (cb.x0 === 20 && cb.y0 === 24));
  const [nl, nm, nd] = [0, 1, 2].map((t) => pts('hair', t).length) as [number, number, number];
  out['2 cabelo'] = {
    value: `brilho ${cb ? `${crown!.length}px x${cb.x0}–${cb.x1} y${cb.y0}–${cb.y1}` : 'ausente'} (${lightParts.length} componente); claro ${nl} médio ${nm} escuro ${nd} (claro ${((nl / hair.length) * 100).toFixed(0)}%)`,
    pass: Boolean(crownBox && crownAt) && nm > nl && nm > nd && nl / hair.length < 0.3,
  };

  // 3 face (south only)
  if (facing === 'south') {
    const inks: Pt[] = [];
    for (let y = minY; y < neckTop; y += 1) for (let x = 0; x < W; x += 1) if (getPixel(img, x, y) === INK) inks.push([x, y]);
    const eyes = inks.filter(([x, y]) => mat(x + 1, y) === 'skin' && tone(x + 1, y) === 0).sort((a, b) => a[0] - b[0]);
    const brow = (x: number, y: number) => {
      for (let s = x - 1; s <= x; s += 1) {
        if ([0, 1, 2].every((d) => mat(s + d, y - 1) === 'hair' && tone(s + d, y - 1) === 2)) return true;
      }
      return false;
    };
    const brows = eyes.filter(([x, y]) => brow(x, y)).length;
    const darkSkin = components(pts('skin', 2));
    const mouth = darkSkin.find((c) => {
      const b = box(c);
      return c.length === 2 && b.y0 === b.y1 && Math.abs((b.x0 + b.x1) / 2 - 23.5) <= 1 && b.y0 < neckTop
        && c.every(([x, y]) => STEPS4.every(([dx, dy]) => c.some(([cx, cy]) => cx === x + dx && cy === y + dy) || (mat(x + dx, y + dy) === 'skin' && tone(x + dx, y + dy) !== 2)));
    });
    const gap = eyes.length === 2 ? eyes[1]![0] - (eyes[0]![0] + 1) - 1 : -1;
    const browY = eyes.length === 2 ? eyes[0]![1] - 1 : -1;
    const gapX0 = eyes.length === 2 ? eyes[0]![0] + 2 : 0;
    const gapX1 = eyes.length === 2 ? eyes[1]![0] - 1 : -1;
    const browGap = gapX1 - gapX0 + 1;
    const browGapSkin = eyes.length === 2 && Array.from({ length: Math.max(0, browGap) }, (_, i) => gapX0 + i).every((x) => mat(x, browY) === 'skin' && tone(x, browY) === 0);
    out['3 rosto'] = {
      value: `olhos ${eyes.map(([x, y]) => `x${x}+${x + 1} y${y}`).join(', ')}; sobrancelhas ${brows}; vão das sobrancelhas ${browGap}px pele ${browGapSkin}; boca ${mouth ? `x${box(mouth).x0}–${box(mouth).x1} y${box(mouth).y0}` : 'ausente'}; gap ${gap}; ink no rosto ${inks.length}`,
      pass: eyes.length === 2 && inks.length === 2 && eyes[0]![1] === eyes[1]![1] && brows === 2 && Boolean(mouth) && gap >= 3 && gap <= 4 && browGap === 4 && browGapSkin,
    };
  }

  if (facing === 'east' || facing === 'west') {
    const front = facing === 'east' ? 1 : -1;
    const inks: Pt[] = [];
    for (let y = minY; y < neckTop; y += 1) for (let x = 0; x < W; x += 1) if (getPixel(img, x, y) === INK) inks.push([x, y]);
    const eyes = inks.filter(([x, y]) => mat(x + front, y) === 'skin' && tone(x + front, y) === 0);
    const eye = eyes[0];
    const e0 = eye ? Math.min(eye[0], eye[0] + front) : 0;
    const brow = eye && [e0 - 1, e0].some((s) =>
      [0, 1, 2].every((d) => mat(s + d, eye[1] - 1) === 'hair' && tone(s + d, eye[1] - 1) === 2));
    const mouth = components(pts('skin', 2)).find((c) => {
      const b = box(c);
      const edge = facing === 'east' ? b.x1 + 1 : b.x0 - 1;
      return c.length === 2 && b.y0 === b.y1 && b.y0 < neckTop && b.y0 > (eye?.[1] ?? H) && !opaque(edge, b.y0);
    });
    const headSkin = pts('skin').filter(([, y]) => y >= minY && y < neckTop);
    const frontX = headSkin.length === 0 ? -1 : facing === 'east' ? Math.max(...headSkin.map(([x]) => x)) : Math.min(...headSkin.map(([x]) => x));
    const noseRows = headSkin.filter(([x]) => x === frontX).map(([, y]) => y).sort((a, b) => a - b);
    let nose = 0;
    let run = 0;
    let prev = -99;
    for (const y of noseRows) {
      run = y === prev + 1 ? run + 1 : 1;
      prev = y;
      nose = Math.max(nose, run);
    }
    out['3 rosto'] = {
      value: `perfil: olho ${eye ? `x${eye[0]}+${eye[0] + front} y${eye[1]}` : 'ausente'}; sobrancelha ${brow ? 'sim' : 'não'}; nariz ${nose}px em x${frontX}; boca ${mouth ? `x${box(mouth).x0}–${box(mouth).x1} y${box(mouth).y0} na frente` : 'ausente'}; ink no rosto ${inks.length}. Segundo olho e gap não se aplicam de perfil`,
      pass: eyes.length === 1 && inks.length === 1 && Boolean(brow) && Boolean(mouth) && nose >= 2,
    };
  } else if (facing === 'north') {
    let ink = 0;
    for (let y = minY; y < neckTop; y += 1) for (let x = 0; x < W; x += 1) if (getPixel(img, x, y) === INK) ink += 1;
    const skinInHead = pts('skin').filter(([, y]) => y < neckTop - 1).length;
    out['3 rosto'] = { value: `costas: rosto não aparece; ink na cabeça ${ink}, pele acima da nuca ${skinInHead}`, pass: ink === 0 };
  }

  // 4 arm and hand
  if (facing === 'east' || facing === 'west') {
    const torsoRow = pts('shirt').filter(([, y]) => y === firstShirt).map(([x]) => x);
    const tL = Math.min(...torsoRow);
    const tR = Math.max(...torsoRow);
    const hands = components(pts('skin').filter(([, y]) => y >= firstShirt)).filter((c) => hasBlock(c, 3, 3));
    const info = hands.map((c) => {
      const b = box(c);
      const past = facing === 'east' ? b.x1 - tR : tL - b.x0;
      const cuff = c.filter(([, y]) => y === b.y0).every(([x, y]) => mat(x, y - 1) === 'shirt' && tone(x, y - 1) === 2);
      return { b, past, cuff };
    });
    const hand = info[0];
    const at = hand ? rowSpan(hand.b.y0) : 0;
    const below = hand ? rowSpan(hand.b.y1 + 1) : 0;
    out['4 braço e mão'] = {
      value: `perfil: mão ${hand ? `x${hand.b.x0}–${hand.b.x1} y${hand.b.y0}–${hand.b.y1}, ${hand.past}px à frente do peito, manga-escura ${hand.cuff}` : 'ausente'}; largura na mão ${at} × abaixo ${below}. Braço de trás oculto pelo tronco: o segundo dente não existe de perfil`,
      pass: info.length === 1 && hand!.past >= 2 && hand!.cuff && at - below >= 2,
    };
  }

  if (facing === 'south' || facing === 'north') {
    const torsoRow = pts('shirt').filter(([, y]) => y === firstShirt).map(([x]) => x);
    const torsoL = Math.min(...torsoRow);
    const torsoR = Math.max(...torsoRow);
    const lowSkin = pts('skin').filter(([, y]) => y >= firstShirt);
    const hands = components(lowSkin).filter((c) => hasBlock(c, 3, 3));
    const handInfo = hands.map((c) => {
      const b = box(c);
      const out_ = Math.max(torsoL - b.x0, b.x1 - torsoR);
      const cuff = c.filter(([, y]) => y === b.y0).every(([x, y]) => mat(x, y - 1) === 'shirt' && tone(x, y - 1) === 2);
      return { b, out_, cuff };
    });
    const lefts = handInfo.filter((h) => h.b.x1 < torsoL + 1 && h.out_ >= 2);
    const rights = handInfo.filter((h) => h.b.x0 > torsoR - 1 && h.out_ >= 2);
    const handRows = handInfo.map((h) => h.b.y0);
    const wideAtHands = handRows.length ? rowSpan(handRows[0]!) : 0;
    const belowHands = handInfo.length ? rowSpan(Math.max(...handInfo.map((h) => h.b.y1)) + 1) : 0;
    out['4 braço e mão'] = {
      value: handInfo.map((h) => `mão x${h.b.x0}–${h.b.x1} y${h.b.y0}–${h.b.y1} fora ${h.out_}px manga-escura ${h.cuff}`).join(' | ') + `; largura na mão ${wideAtHands} × abaixo ${belowHands}`,
      pass: lefts.length === 1 && rights.length === 1 && handInfo.every((h) => h.cuff) && wideAtHands - belowHands >= 4,
    };
  }

  // 5 folds
  const folds: string[] = [];
  let foldsOk = true;
  for (const m of ['shirt', 'pants'] as const) {
    const light = pts(m, 0);
    const lightY = light.reduce((s, [, y]) => s + y, 0) / light.length;
    const darks = components(pts(m, 2));
    const each = darks.map((c) => {
      const b = box(c);
      const cy = c.reduce((s, [, y]) => s + y, 0) / c.length;
      return { n: c.length, w: b.x1 - b.x0 + 1, block: hasBlock(c, 2, 2), south: cy > lightY };
    });
    const ribbons = pts(m, 2).filter(([x, y]) => !(mat(x - 1, y) === m && tone(x - 1, y) === 2) && !(mat(x + 1, y) === m && tone(x + 1, y) === 2)).length;
    const cap = m === 'shirt' ? 4 : 3;
    const ok = darks.length >= 2 && darks.length <= cap && each.every((e) => e.n >= 4 && e.n <= 12 && e.w >= 2 && e.w <= 6 && e.block && e.south) && ribbons === 0;
    foldsOk &&= ok;
    folds.push(`${m} ${darks.length} clusters [${each.map((e) => `${e.n}px w${e.w}${e.block ? '' : ' sem2×2'}${e.south ? '' : ' norte'}`).join(', ')}] fitas1px ${ribbons}`);
  }
  out['5 dobras'] = { value: folds.join(' | '), pass: foldsOk };

  // 6 hue shift
  const hue: string[] = [];
  let hueOk = true;
  for (const m of ['skin', 'shirt', 'pants', 'hair'] as const) {
    const [l, md, d] = PALETTE[m];
    const shift = bMinusR(d) - bMinusR(l);
    const falling = lum(l) > lum(md) && lum(md) > lum(d);
    const ratios = [16, 8, 0].map((s) => ((d >>> s) & 0xff) / Math.max(1, (l >>> s) & 0xff));
    const scaled = Math.max(...ratios) - Math.min(...ratios) < 0.05;
    const ok = shift >= 15 && falling && !scaled;
    hueOk &&= ok;
    hue.push(`${m} Δ(B−R) ${shift >= 0 ? '+' : ''}${shift}, L ${Math.round(lum(l))}>${Math.round(lum(md))}>${Math.round(lum(d))}${scaled ? ' ×k' : ''}`);
  }
  out['6 hue shift'] = { value: hue.join(' | '), pass: hueOk };

  // 7 sel-out
  let ink = 0;
  let northEdge = 0;
  let edge = 0;
  let edgeDark = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = getPixel(img, x, y);
    if (c < 0) continue;
    if (c === INK) ink += 1;
    if (!opaque(x, y - 1) && c !== INK) northEdge += 1;
    const sideOrSouth = !opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y + 1);
    if (sideOrSouth && opaque(x, y - 1)) {
      edge += 1;
      if (tone(x, y) === 2) edgeDark += 1;
    }
  }
  out['7 sel-out'] = {
    value: `ink ${ink} px; aresta norte sem ink ${northEdge} px; borda sul/lateral no tom escuro ${edgeDark}/${edge}`,
    pass: ink <= 16 && northEdge > 0,
  };

  // 8 contact shadow
  const { grass, path, shadowTop, shadowBottom } = extra.composites;
  const block = (comp: Rgba, top: number, bottom: number) => {
    let ok = 0;
    for (let x = 18; x <= 29; x += 1) {
      if (getPixel(comp, x, 56) === top) ok += 1;
      if (getPixel(comp, x, 57) === bottom) ok += 1;
    }
    return ok;
  };
  let row56 = 0;
  for (let x = 0; x < W; x += 1) if (opaque(x, 56)) row56 += 1;
  const shoeColors = new Set(PALETTE.shoe);
  const g = block(grass, shadowTop[0]!, shadowBottom[0]!);
  const pa = block(path, shadowTop[1]!, shadowBottom[1]!);
  const shadowInk = [...shadowTop, ...shadowBottom].some((c) => c === INK || shoeColors.has(c));
  out['8 sombra de contato'] = {
    value: `grama ${g}/24, caminho ${pa}/24, fileira 56 do PNG ${row56} px, sombra com cor de sapato/ink ${shadowInk}`,
    pass: g === 24 && pa === 24 && row56 === 0 && !shadowInk,
  };

  // 10 original and clean
  const colors = new Set<number>();
  let dirty = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 0 && img.data[i] !== 255) dirty += 1;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (opaque(x, y)) colors.add(getPixel(img, x, y));
  const shared = [...colors].filter((c) => extra.refColors.has(c)).length;
  let inter = 0, union = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const a = getPixel(extra.pilot, x, y) >= 0;
    const b = opaque(x, y);
    if (a && b) inter += 1;
    if (a || b) union += 1;
  }
  const iou = inter / union;
  out['10 original e limpo'] = {
    value: `${colors.size} cores, alpha sujo ${dirty}, hex iguais à referência ${shared}, IoU piloto ${iou.toFixed(3)}, camisa roxo-índigo + calça cáqui`,
    pass: colors.size <= 16 && dirty === 0 && shared === 0 && iou < 0.8,
  };

  const firstEight = Object.entries(out).filter(([k]) => !k.startsWith('10')).every(([, v]) => v.pass);
  const reads = facing === 'north'
    ? 'cabeça sem rosto, mãos, pés separados e chão apontáveis'
    : facing === 'south'
      ? 'cabeça, olhos, mãos, pés separados e chão apontáveis'
      : 'cabeça, um olho, nariz, uma mão, pés separados e chão apontáveis';
  out['9 leitura a 1×'] = {
    value: `itens 1–8 ${firstEight ? 'verdadeiros' : 'com falha'}; leitura a olho nos compostos 1×: ${extra.readsAt1x === null ? 'pendente' : extra.readsAt1x ? reads : 'não lê'}`,
    pass: firstEight && extra.readsAt1x === true,
  };
  void minX; void maxX;
  return out;
}
