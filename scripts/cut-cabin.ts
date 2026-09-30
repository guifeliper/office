/**
 * Crop the Cabana Norte slice and the Tiny Farm cast into runtime art.
 * Source sheets stay outside the repo. Only the cells the app draws are written.
 *
 *   npx vite-node scripts/cut-cabin.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createImage, readPng, stats, writePng, type Rgba } from './png';
import { CACHE, packRoot } from './pack-paths';

const PACK = packRoot();
const CABIN = path.join(CACHE, 'cabin');
const CAST = path.join(CACHE, 'cast');
const CHAR = path.join(PACK, 'Character/Character/PNG');

function sheet(rel: string, w: number, h: number): Rgba {
  const img = readPng(path.join(PACK, rel));
  if (img.width !== w || img.height !== h) throw new Error(`${rel} is ${img.width}×${img.height}, expected ${w}×${h}`);
  return img;
}

function crop(src: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = createImage(w, h);
  for (let yy = 0; yy < h; yy += 1) {
    const from = ((y + yy) * src.width + x) * 4;
    out.data.set(src.data.subarray(from, from + w * 4), yy * w * 4);
  }
  return out;
}

function over(dst: Rgba, src: Rgba, dx = 0, dy = 0): void {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const s = (y * src.width + x) * 4;
      if (src.data[s + 3] === 0) continue;
      const d = ((y + dy) * dst.width + (x + dx)) * 4;
      dst.data.set([src.data[s]!, src.data[s + 1]!, src.data[s + 2]!, 255], d);
    }
  }
}

/** A few fishing rows only ship green eyes. Use that color instead of dropping the look. */
function resolveLayer(base: string, rel: string): string | null {
  const exact = path.join(base, rel);
  if (fs.existsSync(exact)) return exact;
  const green = exact.replace(/\/[^/]+\.png$/, '/Green.png');
  if (fs.existsSync(green)) return green;
  const dir = path.dirname(exact);
  if (!fs.existsSync(dir)) return null;
  const png = fs.readdirSync(dir).find((name) => name.endsWith('.png'));
  return png ? path.join(dir, png) : null;
}

/** The fishing rod sheets are drawn at 64 px. Nearest-neighbor halves them onto the 32 px body. */
function down2(src: Rgba): Rgba {
  const out = createImage(src.width / 2, src.height / 2);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const s = ((y * 2) * src.width + x * 2) * 4;
      out.data.set(src.data.subarray(s, s + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

/** Pack art is hard-edged; any partial alpha is snapped so the checker stays clean. */
function snapAlpha(img: Rgba): Rgba {
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! >= 128 ? 255 : 0;
  return img;
}

function write(dir: string, name: string, img: Rgba): void {
  snapAlpha(img);
  writePng(path.join(dir, `${name}.png`), img);
  const s = stats(img);
  const b = s.opaqueBox;
  console.warn(`${name.padEnd(16)} ${img.width}×${img.height} opaque=${b ? `${b.w}×${b.h} @${b.x},${b.y}` : '-'} colors=${s.colors}`);
}

fs.mkdirSync(CABIN, { recursive: true });
fs.mkdirSync(CAST, { recursive: true });

const house = sheet('Tileset/Tileset House.png', 832, 384);
write(CABIN, 'floor', crop(house, 272, 32, 16, 16));
{
  const stack = (rows: number[]) => {
    const out = createImage(64, rows.length * 16);
    rows.forEach((r, i) => over(out, crop(house, 0, r * 16, 64, 16), 0, i * 16));
    return out;
  };
  write(CABIN, 'wall-window', stack([5, 8, 9]));
  write(CABIN, 'wall-plain', stack([5, 6, 7]));
}

const fire = sheet('Objects/Interior/Fireplace.png', 256, 256);
write(CABIN, 'fireplace', crop(fire, 32, 0, 32, 48));
for (let i = 0; i < 4; i += 1) write(CABIN, `flame-${i}`, crop(fire, 48 + i * 32, 136, 32, 16));

const tables = sheet('Objects/Interior/Tables and desks.png', 512, 384);
write(CABIN, 'desk', crop(tables, 0, 192, 32, 32));

const chairs = sheet('Objects/Interior/Chairs.png', 304, 224);
write(CABIN, 'chair-north', crop(chairs, 144, 0, 16, 32));

const computers = sheet('Objects/Interior/Part 2 copiar.png', 256, 144);
write(CABIN, 'computer', crop(computers, 64, 64, 32, 32));

const part1 = sheet('Objects/Interior/Part 1 copiar.png', 272, 192);
write(CABIN, 'plant', crop(part1, 112, 144, 16, 32));
write(CABIN, 'mug', crop(part1, 240, 16, 16, 16));

const kitchen = sheet('Objects/Interior/Part 9 copiar.png', 688, 112);
write(CABIN, 'counter', crop(kitchen, 0, 72, 48, 24));

const pot = sheet('Objects/Work Benches/Kitchen pot.png', 160, 32);
write(CABIN, 'kettle', crop(pot, 0, 0, 32, 32));

const sofa = sheet('Objects/Interior/Sofa and armchair.png', 320, 192);
write(CABIN, 'armchair', crop(sofa, 256, 96, 32, 32));

const others = sheet('Objects/Interior/Others.png', 144, 112);
write(CABIN, 'bookshelf', crop(others, 0, 40, 32, 40));

const cat = sheet('Animals/Pets/Cats/1/Ginger.png', 128, 416);
write(CABIN, 'cat', crop(cat, 0, 9 * 32, 32, 32));

const door = sheet('Objects/Exterior/Houses/Door, windows, and chimney/Double doors.png', 128, 64);
write(CABIN, 'door', crop(door, 32, 0, 32, 32));

/**
 * Cast. One strip per look, one row per action, 32×32 cells, pack order south/north/east/west.
 * Rows: idle, walk, sit, axe, hoe, watering, the fishing cycle
 * (cast 15, wait 4, bite 8, reel 4, catch 4 frames per facing),
 * then carrying idle 4, carrying walk 6, pick-up 4, bug net 6, petting 3.
 * Sleep is the last row: 6 frames, not four facings (see asset-availability).
 * Folder 22 Flute is 576×32 (18 frames). 18 is not divisible by 4, so it has no
 * south/north/east/west set. The fourth facing is absent and is not mirrored.
 * The strip is as wide as the cast, 1920.
 */
const STRIP_W = 1920;
const ACTIONS = [
  { dir: '1. Idle', w: 512 },
  { dir: '2. Walk', w: 768 },
  { dir: '18. Setting', w: 128 },
  { dir: '5. Axe and Sickle', w: 768, weapon: 'Weapons/Axe/1.png' },
  { dir: '4. Pickaxe, Hoe and Catching insects', w: 768, weapon: 'Weapons/Hoe/1.png' },
  { dir: '7. Watering', w: 1024, weapon: 'Weapons/Watering/1.png' },
  { dir: '12. Fishing - Cast', w: 1920, weapon: 'Weapons/1.png', scale: 2 },
  { dir: '12.1. Fishing - Wait', w: 512, weapon: 'Weapons/1.png', scale: 2 },
  { dir: '12.2. Fishing - Bite', w: 1024, weapon: 'Weapons/1.png', scale: 2 },
  { dir: '12.3. Fishing - Reel', w: 512, weapon: 'Weapons/1.png', scale: 2 },
  { dir: '12.4. Fishing - Catch', w: 512, weapon: 'Weapons/1.png', scale: 2 },
  { dir: '13. Carrying - Idle', w: 512 },
  { dir: '13.1 Carrying - Walk', w: 768 },
  { dir: '13.3 Carrying - Pick Up', w: 512 },
  { dir: '4. Pickaxe, Hoe and Catching insects', w: 768, weapon: 'Weapons/Bug net.png' },
  { dir: '20. Petting', w: 384 },
  // No farm-clothes folder. Skin, hair, and green eyes (resolveLayer) only.
  { dir: '19. Sleep', w: 192, bare: true },
] as const;

const HAIRS = ['Josh', 'Lyria', 'Standard', 'Fawn', 'Sebastian', 'Iridessa', 'Silvermist'] as const;
const MALE = new Set(['Josh', 'Standard', 'Sebastian']);
const HAIR_COLORS = ['Brown', 'Black', 'Blonde', 'Ginger'] as const;
const CLOTHES = ['Blue', 'Green', 'Red', 'Purple', 'Pink'] as const;
const EYES = ['Brown', 'Black', 'Blue', 'Green'] as const;
export const LOOK_COUNT = 16;

for (let i = 0; i < LOOK_COUNT; i += 1) {
  const hair = HAIRS[i % HAIRS.length]!;
  const look = {
    skin: `${(i % 4) + 1}`,
    cloth: CLOTHES[(i * 3) % CLOTHES.length]!,
    hair,
    hairColor: HAIR_COLORS[Math.floor(i / 2) % HAIR_COLORS.length]!,
    eyes: `${MALE.has(hair) ? 'Male' : 'Female'}/${EYES[i % EYES.length]}`,
  };
  const out = createImage(STRIP_W, ACTIONS.length * 32);
  ACTIONS.forEach((action, row) => {
    const base = path.join(CHAR, action.dir);
    const layers = [
      `Skins/${look.skin}.png`,
      `Eyes/${look.eyes}.png`,
      ...('bare' in action ? [] : [`Clothers/Farm/${look.cloth}.png`]),
      `Hair's/${look.hair}/${look.hairColor}.png`,
      ...('weapon' in action ? [action.weapon] : []),
    ];
    for (const rel of layers) {
      const file = resolveLayer(base, rel);
      if (!file) throw new Error(`missing layer ${action.dir}/${rel}`);
      const raw = readPng(file);
      const scaled = 'scale' in action && action.scale === 2 && rel.startsWith('Weapons/') ? down2(raw) : raw;
      if (scaled.width !== action.w || scaled.height !== 32) {
        throw new Error(`${action.dir}/${rel} is ${raw.width}×${raw.height}`);
      }
      over(out, scaled, 0, row * 32);
    }
  });
  write(CAST, `look-${String(i).padStart(2, '0')}`, out);
}
console.warn('wrote', CABIN, CAST);
