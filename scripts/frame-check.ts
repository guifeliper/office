/**
 * Round-4 checker. The round-2b rules stay, and every walk frame adds a sole rise
 * of at least 4 px and an arm swing of at least 2 px. A tool counts only when it
 * touches a hand pixel.
 */
import { paintMatrix, type Material, type Painted, type Rgba } from './body-art';
import {
  AXE_HANDLE,
  AXE_HEAD,
  CAN_COLOR,
  DROP_COLOR,
  HAIR_RAMPS,
  OUTFIT_RAMPS,
  SKIN_RAMPS,
  STILL,
  alphaMask,
  axeMatrix,
  axeTools,
  campfireMatrix,
  contrastOk,
  gardenMatrix,
  gardenTools,
  hueShiftOk,
  paintPose,
  shapeMatrix,
  stampTools,
  typingMatrix,
  walkMatrix,
  type ToolPixel,
} from '../src/renderer/office/cast';
import type { Appearance, Facing } from '../src/renderer/office/paper-doll';

const W = 48;
type Feet = 'split' | 'knees' | 'seat';

export interface FrameCheck {
  name: string;
  pass: boolean;
  detail: string;
}

const BASE: Appearance = { skin: 0, hair: 0, hairShape: 0, outfit: 0, hat: 0, accessory: 0 };

function components(points: [number, number][]): [number, number][][] {
  const left = new Set(points.map(([x, y]) => y * W + x));
  const out: [number, number][][] = [];
  for (const [sx, sy] of points) {
    if (!left.has(sy * W + sx)) continue;
    const comp: [number, number][] = [];
    const stack: [number, number][] = [[sx, sy]];
    left.delete(sy * W + sx);
    while (stack.length) {
      const [x, y] = stack.pop()!;
      comp.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = (y + dy) * W + (x + dx);
        if (!left.has(k)) continue;
        left.delete(k);
        stack.push([x + dx, y + dy]);
      }
    }
    out.push(comp);
  }
  return out;
}

function pts(painted: Painted, material: Material, tone?: number): [number, number][] {
  const list: [number, number][] = [];
  for (const [k, m] of painted.material) {
    if (m !== material) continue;
    if (tone !== undefined && painted.tone.get(k) !== tone) continue;
    list.push([k % W, Math.floor(k / W)]);
  }
  return list;
}

function box(points: [number, number][]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function hasBlock(points: [number, number][], size: number): boolean {
  const set = new Set(points.map(([x, y]) => y * W + x));
  return points.some(([x, y]) => {
    for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) {
      if (!set.has((y + dy) * W + x + dx)) return false;
    }
    return true;
  });
}

function rowEmpty(painted: Painted, y: number): boolean {
  for (let x = 0; x < W; x += 1) if (painted.image.data[(y * W + x) * 4 + 3] !== 0) return false;
  return true;
}

function binaryAlpha(painted: Painted): boolean {
  for (let i = 3; i < painted.image.data.length; i += 4) {
    const a = painted.image.data[i]!;
    if (a !== 0 && a !== 255) return false;
  }
  return true;
}

function hairStep(painted: Painted): boolean {
  const spans: number[] = [];
  for (let y = 0; y < 68; y += 1) {
    let a = W;
    let b = -1;
    for (let x = 0; x < W; x += 1) if (painted.material.get(y * W + x) === 'hair') {
      a = Math.min(a, x);
      b = Math.max(b, x);
    }
    spans.push(b < 0 ? 0 : b - a + 1);
  }
  for (let y = 0; y < spans.length - 1; y += 1) {
    if (spans[y]! >= 4 && spans[y + 1]! >= spans[y]! + 2) return true;
  }
  return false;
}

function feetOk(painted: Painted, kind: Feet): string | null {
  if (kind === 'seat') return null;
  if (kind === 'knees') {
    let y = 55;
    while (y > 0 && rowEmpty(painted, y)) y -= 1;
    const runs = components(Array.from({ length: W }, (_, x) => [x, y] as [number, number]).filter(([x, yy]) => painted.image.data[(yy * W + x) * 4 + 3] !== 0));
    return runs.length >= 2 ? null : `joelhos ${runs.length}`;
  }
  const shoes = components(pts(painted, 'shoe'));
  if (shoes.length !== 2) return `sapatos ${shoes.length}`;
  const [a, b] = shoes.map(box).sort((p, q) => p.x0 - q.x0);
  if (!a || !b || a.x1 >= b.x0) return 'pés juntos';
  return null;
}

export function checkFrame(name: string, painted: Painted, feet: Feet): FrameCheck {
  const notes: string[] = [];
  if (!rowEmpty(painted, 56)) notes.push('fileira 56');
  if (!binaryAlpha(painted)) notes.push('alpha');
  const shine = components(pts(painted, 'hair', 0));
  if (shine.length !== 1 || shine[0]!.length !== 12) notes.push(`brilho ${shine.length}×${shine[0]?.length ?? 0}`);
  else {
    const b = box(shine[0]!);
    if (b.x1 - b.x0 + 1 !== 4 || b.y1 - b.y0 + 1 !== 3) notes.push('brilho não é 4×3');
  }
  if (!hairStep(painted)) notes.push('sem degrau');
  if (!hasBlock(pts(painted, 'skin'), 3)) notes.push('mão < 3×3');
  const feetNote = feetOk(painted, feet);
  if (feetNote) notes.push(feetNote);
  let maxY = -1;
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < W; x += 1) {
    if (painted.image.data[(y * W + x) * 4 + 3] !== 0) maxY = Math.max(maxY, y);
  }
  if (maxY > 55) notes.push(`maxY ${maxY}`);
  return { name, pass: notes.length === 0, detail: notes.join(', ') || 'ok' };
}

const FACINGS: Facing[] = ['south', 'north', 'east', 'west'];

export function checkCatalog(): FrameCheck[] {
  const out: FrameCheck[] = [];
  const ramps = [
    ...SKIN_RAMPS.map((ramp, i) => [`pele ${i}`, ramp] as const),
    ...HAIR_RAMPS.map((ramp, i) => [`cabelo ${i}`, ramp] as const),
    ...OUTFIT_RAMPS.flatMap((outfit, i) => [
      [`camisa ${i}`, outfit.shirt] as const,
      [`calça ${i}`, outfit.pants] as const,
    ]),
  ];
  for (const [name, ramp] of ramps) {
    out.push({ name: `hue ${name}`, pass: hueShiftOk(ramp), detail: hueShiftOk(ramp) ? 'ok' : 'hue' });
  }
  for (const [name, ramp] of ramps.filter(([label]) => label.startsWith('camisa') || label.startsWith('calça'))) {
    const pass = ramp.every(contrastOk);
    out.push({ name: `contraste ${name}`, pass, detail: pass ? 'ok' : 'contraste' });
  }
  return out;
}

function withTools(matrix: { left: number; top: number; rows: readonly string[] }, tools: readonly ToolPixel[]): Painted {
  const painted = paintMatrix(matrix);
  stampTools(painted.image, matrix, tools);
  return painted;
}

function rgbAt(painted: Painted, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= W || y >= 68) return -1;
  const o = (y * W + x) * 4;
  if (painted.image.data[o + 3] === 0) return -1;
  return (painted.image.data[o]! << 16) | (painted.image.data[o + 1]! << 8) | painted.image.data[o + 2]!;
}

export function shoeRise(painted: Painted): number {
  const shoes = components(pts(painted, 'shoe'));
  if (shoes.length < 2) return 0;
  const soles = shoes.map((shoe) => Math.max(...shoe.map(([, y]) => y)));
  return Math.max(...soles) - Math.min(...soles);
}

export function shoeGap(painted: Painted): number {
  const shoes = components(pts(painted, 'shoe')).map(box).sort((a, b) => a.x0 - b.x0);
  const left = shoes[0];
  const right = shoes[1];
  if (!left || !right) return 0;
  return right.x0 - left.x1 - 1;
}

function minHairY(painted: Painted): number {
  const ys = pts(painted, 'hair').map(([, y]) => y);
  return ys.length ? Math.min(...ys) : 0;
}

function handsBelow(painted: Painted) {
  const skin = pts(painted, 'skin').filter(([, y]) => y >= 40);
  return components(skin).filter((hand) => hasBlock(hand, 3)).map(box).sort((a, b) => a.x0 - b.x0);
}

/** How far the two hands moved apart, or how far the single profile hand travelled. */
export function armSwing(still: Painted, frame: Painted): number {
  const before = handsBelow(still);
  const after = handsBelow(frame);
  if (before.length >= 2 && after.length >= 2) {
    const left = after[0]!.y0 - before[0]!.y0;
    const right = after[1]!.y0 - before[1]!.y0;
    return Math.abs(left - right);
  }
  const from = before[before.length - 1];
  const to = after[after.length - 1];
  if (!from || !to) return 0;
  return Math.max(Math.abs(to.x0 - from.x0), Math.abs(to.y0 - from.y0));
}

function countColor(painted: Painted, color: number): number {
  let n = 0;
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < W; x += 1) if (rgbAt(painted, x, y) === color) n += 1;
  return n;
}

function colorTouchesSkin(painted: Painted, color: number): boolean {
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < W; x += 1) {
    if (rgbAt(painted, x, y) !== color) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (painted.material.get((y + dy) * W + (x + dx)) === 'skin') return true;
    }
  }
  return false;
}

function dropCluster(painted: Painted): number {
  const drops: [number, number][] = [];
  for (let y = 0; y < 68; y += 1) for (let x = 0; x < W; x += 1) if (rgbAt(painted, x, y) === DROP_COLOR) drops.push([x, y]);
  if (!drops.length) return 0;
  return Math.max(...components(drops).map((c) => c.length));
}

function add(out: FrameCheck[], name: string, painted: Painted, feet: Feet, extra: string[]): void {
  const check = checkFrame(name, painted, feet);
  const notes = [...(check.pass ? [] : [check.detail]), ...extra];
  out.push({ name, pass: notes.length === 0, detail: notes.join(', ') || 'ok' });
}

export function checkAllFrames(): FrameCheck[] {
  const out: FrameCheck[] = [];
  const stills = new Map(FACINGS.map((facing) => [facing, paintMatrix(STILL[facing])]));
  for (const facing of FACINGS) {
    const still = stills.get(facing)!;
    out.push(checkFrame(`still ${facing}`, still, 'split'));
    for (let frame = 0; frame < 6; frame += 1) {
      const painted = paintMatrix(walkMatrix(facing, frame));
      const rise = shoeRise(painted);
      const gap = shoeGap(painted);
      const swing = armSwing(still, painted);
      const bob = minHairY(still) - minHairY(painted);
      const expectBob = frame === 2 || frame === 5 ? 2 : frame === 1 || frame === 4 ? 1 : 0;
      const extra: string[] = [];
      if (rise < 4) extra.push(`pé ${rise}px`);
      if ((frame === 0 || frame === 3) && gap < 4) extra.push(`vão ${gap}px`);
      if (swing < 2) extra.push(`braço ${swing}px`);
      if (bob !== expectBob) extra.push(`bob ${bob}px`);
      add(out, `walk ${facing} ${frame}`, painted, 'split', extra);
    }
  }
  for (let frame = 0; frame < 4; frame += 1) {
    out.push(checkFrame(`sit ${frame}`, paintMatrix(typingMatrix(frame)), 'seat'));
    const fire = paintMatrix(campfireMatrix(frame));
    const fireNotes: string[] = [];
    const rest = paintMatrix(campfireMatrix(0));
    if (frame % 2 === 1 && minHairY(rest) - minHairY(fire) !== 1) fireNotes.push('sem respiração');
    if (frame % 2 === 0 && minHairY(fire) !== minHairY(rest)) fireNotes.push('respiração no frame par');
    add(out, `fogueira ${frame}`, fire, 'seat', fireNotes);
    const axe = withTools(axeMatrix(frame), axeTools(frame));
    const axeNotes: string[] = [];
    if (countColor(axe, AXE_HANDLE) !== 20) axeNotes.push(`cabo ${countColor(axe, AXE_HANDLE)}`);
    if (countColor(axe, AXE_HEAD) !== 12) axeNotes.push(`lâmina ${countColor(axe, AXE_HEAD)}`);
    if (!colorTouchesSkin(axe, AXE_HANDLE)) axeNotes.push('cabo solto');
    add(out, `machado ${frame}`, axe, 'split', axeNotes);
  }
  const stood = paintMatrix(STILL.south);
  for (let frame = 0; frame < 3; frame += 1) {
    const garden = withTools(gardenMatrix(frame), gardenTools(frame));
    const notes: string[] = [];
    if (minHairY(garden) !== minHairY(stood)) notes.push(`cabeça y${minHairY(garden)}`);
    let maxY = -1;
    let minY = 68;
    for (let y = 0; y < 68; y += 1) for (let x = 0; x < W; x += 1) {
      if (garden.image.data[(y * W + x) * 4 + 3] === 0) continue;
      maxY = Math.max(maxY, y);
      minY = Math.min(minY, y);
    }
    if (maxY - minY + 1 < 32) notes.push(`altura ${maxY - minY + 1}`);
    if (countColor(garden, CAN_COLOR) !== 12) notes.push(`regador ${countColor(garden, CAN_COLOR)}`);
    if (!colorTouchesSkin(garden, CAN_COLOR)) notes.push('regador solto');
    const drops = dropCluster(garden);
    if (drops < 2 || drops > 3) notes.push(`gotas ${drops}`);
    add(out, `jardim ${frame}`, garden, 'knees', notes);
  }
  return out;
}

function look(patch: Partial<Appearance>): Appearance {
  return { ...BASE, ...patch };
}

/** Same shape, two ramps: the alpha mask does not move. */
export function checkRecolor(): FrameCheck[] {
  const out: FrameCheck[] = [];
  const poses: { name: string; image: (look: Appearance) => Rgba }[] = [];
  for (const facing of FACINGS) {
    poses.push({ name: `still ${facing}`, image: (a) => paintPose(STILL[facing], a, facing) });
    for (let frame = 0; frame < 6; frame += 1) {
      const matrix = walkMatrix(facing, frame);
      poses.push({ name: `walk ${facing} ${frame}`, image: (a) => paintPose(matrix, a, facing) });
    }
  }
  for (let frame = 0; frame < 4; frame += 1) {
    const typing = typingMatrix(frame);
    const fire = campfireMatrix(frame);
    const axe = axeMatrix(frame);
    const axeMark = axeTools(frame);
    poses.push({ name: `sit ${frame}`, image: (a) => paintPose(typing, a, 'north') });
    poses.push({ name: `fogueira ${frame}`, image: (a) => paintPose(fire, a, 'east') });
    poses.push({ name: `machado ${frame}`, image: (a) => paintPose(axe, a, 'north', axeMark) });
  }
  for (let frame = 0; frame < 3; frame += 1) {
    const garden = gardenMatrix(frame);
    const can = gardenTools(frame);
    poses.push({ name: `jardim ${frame}`, image: (a) => paintPose(garden, a, 'south', can) });
  }
  for (const pose of poses) {
    const a = alphaMask(pose.image(look({ skin: 0, outfit: 0 })));
    const b = alphaMask(pose.image(look({ skin: 4, hair: 3, outfit: 2 })));
    out.push({ name: `recolor ${pose.name}`, pass: a === b, detail: a === b ? 'ok' : 'máscara mudou' });
  }
  for (let frame = 0; frame < 6; frame += 1) {
    const east = alphaMask(paintPose(walkMatrix('east', frame), BASE, 'east'));
    const west = alphaMask(paintPose(walkMatrix('west', frame), BASE, 'west'));
    let mirror = '';
    for (let y = 0; y < 68; y += 1) mirror += [...east.slice(y * W, (y + 1) * W)].reverse().join('');
    out.push({ name: `espelho ${frame}`, pass: west === mirror, detail: west === mirror ? 'ok' : 'west ≠ east' });
  }
  return out;
}

/**
 * Every catalog look keeps the same alpha as the other colors of its silhouette
 * on the new walk, axe, garden and campfire frames. Geometry (shine, step, hand)
 * is checked on the three hair shapes before hats recolor the crown.
 */
export function checkCombinations(): { looks: number; failed: string[] } {
  const failed: string[] = [];
  const sample = (look: Appearance) => {
    const passing = walkMatrix('south', 2);
    const axe = axeMatrix(2);
    const garden = gardenMatrix(1);
    const fire = campfireMatrix(1);
    return [
      alphaMask(paintPose(passing, look, 'south')),
      alphaMask(paintPose(axe, look, 'north', axeTools(2))),
      alphaMask(paintPose(garden, look, 'south', gardenTools(1))),
      alphaMask(paintPose(fire, look, 'east')),
    ];
  };
  for (let shape = 0; shape < 3; shape += 1) {
    const shaped = checkFrame(`forma ${shape}`, paintMatrix(shapeMatrix(walkMatrix('south', 2), shape, 'south')), 'split');
    if (!shaped.pass) failed.push(`${shaped.name}: ${shaped.detail}`);
    for (let hat = 0; hat < 4; hat += 1) {
      for (let accessory = 0; accessory < 4; accessory += 1) {
        const base = sample({ skin: 0, hair: 0, hairShape: shape, outfit: 0, hat, accessory });
        for (let skin = 0; skin < 5; skin += 1) {
          for (let hair = 0; hair < 5; hair += 1) {
            for (let outfit = 0; outfit < 4; outfit += 1) {
              if (skin === 0 && hair === 0 && outfit === 0) continue;
              const mask = sample({ skin, hair, hairShape: shape, outfit, hat, accessory });
              if (mask.some((bits, i) => bits !== base[i])) {
                failed.push(`look ${skin}.${hair}.${shape}.${outfit}.${hat}.${accessory}`);
              }
            }
          }
        }
      }
    }
  }
  return { looks: 5 * 5 * 3 * 4 * 4 * 4, failed };
}

if (process.argv[1]?.endsWith('frame-check.ts')) {
  const all = [...checkCatalog(), ...checkAllFrames(), ...checkRecolor()];
  const failed = all.filter((item) => !item.pass);
  console.error(`${all.length - failed.length}/${all.length} ok`);
  for (const item of failed) console.error(`FAIL ${item.name}: ${item.detail}`);
  if (failed.length) process.exit(1);
}
