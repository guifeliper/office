/**
 * Workstation art: the chair, the monitor, and the seated north body.
 * The seated body is the approved matrix (`cast.ts`), not a crop of the pilot.
 * Canvas 48×68, foot anchor on row 56 (the seat).
 */
import type { Appearance, Rgba } from './paper-doll';
import { OUTFIT_RAMPS, sitFrames } from './cast';

export const INK = 0x201b0f;

const WOOD_LIGHT = 0xe6c49a;
const WOOD = 0xc4925a;
const WOOD_DARK = 0x8a5a30;
const WOOD_DEEP = 0x4a3018;

function blank(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function put(img: Rgba, x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const o = (y * img.width + x) * 4;
  img.data[o] = (color >>> 16) & 0xff;
  img.data[o + 1] = (color >>> 8) & 0xff;
  img.data[o + 2] = color & 0xff;
  img.data[o + 3] = 255;
}

function fillRect(img: Rgba, x: number, y: number, w: number, h: number, color: number): void {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) put(img, xx, yy, color);
}

/**
 * Canvas 16×16, drawing 16×14 flush to the bottom. No ink bar on top: that bar crossed
 * the seated neck. Backrest y 2–7, seat y 8–13, south band y 14–15, open back x 3–12 y 6–13.
 * Ink only on the backrest sides; the seat sides stay wood so 2 px of wood show beside the hip.
 */
export function paintChair(): Rgba {
  const img = blank(16, 16);
  fillRect(img, 0, 2, 16, 2, WOOD_LIGHT);
  fillRect(img, 0, 4, 16, 4, WOOD);
  fillRect(img, 0, 8, 16, 6, WOOD_DARK);
  fillRect(img, 0, 14, 16, 2, WOOD_DEEP);
  for (let y = 6; y <= 13; y += 1) for (let x = 3; x <= 12; x += 1) img.data[(y * 16 + x) * 4 + 3] = 0;
  for (let y = 2; y <= 7; y += 1) {
    put(img, 0, y, INK);
    put(img, 15, y, INK);
  }
  for (let y = 8; y <= 15; y += 1) {
    put(img, 0, y, WOOD_DEEP);
    put(img, 15, y, WOOD_DEEP);
  }
  return img;
}

const SCREEN_DARK = 0x2f5874;
const SCREEN = 0x4a7c9b;
const SCREEN_LIGHT = 0x7aabca;
const LED = 0xd4a04a;
const STAND = 0xa3988c;
const STAND_DARK = 0x5e564e;

/** Stand under every frame: 2 px neck in shadow, 8 px foot lit on top, ink silhouette. */
const MONITOR_STAND = [
  '......#DD#......',
  '......#DD#......',
  '......#DD#......',
  '......#DD#......',
  '......#DD#......',
  '......#DD#......',
  '...#LLLLLLLL#...',
  '...##########...',
];

/**
 * Sheet 64×20, frames off, booting, working, standby. Rows 0–11: 14×10 screen in a 1 px
 * bezel. Rows 12–19: stand; its foot (rows 18–19) rests on the desk top.
 */
export function paintMonitor(): Rgba {
  const img = blank(64, 20);
  const screens = [SCREEN_DARK, SCREEN, SCREEN_LIGHT, SCREEN_DARK];
  screens.forEach((fill, index) => {
    const x = index * 16;
    fillRect(img, x, 0, 16, 12, INK);
    fillRect(img, x + 1, 1, 14, 10, fill);
    MONITOR_STAND.forEach((row, dy) => [...row].forEach((code, dx) => {
      if (code === '#') put(img, x + dx, 12 + dy, INK);
      else if (code === 'D') put(img, x + dx, 12 + dy, STAND_DARK);
      else if (code === 'L') put(img, x + dx, 12 + dy, STAND);
    }));
  });
  fillRect(img, 16 + 3, 5, 10, 2, SCREEN_LIGHT);
  fillRect(img, 48 + 13, 9, 2, 2, LED);
  return img;
}


export const SIT_ANCHOR_ROW = 56;

/** Reference look for the station proof. Outfit 2 is the slate shirt. */
export const SIT_PILOT: Appearance = { skin: 0, hair: 0, hairShape: 0, outfit: 2, hat: 0, accessory: 0 };

/** Shirt light and mid per outfit. Both stay ≥ 40 luminance off the chair woods. */
export const SIT_SHIRT: readonly { light: number; main: number }[] = OUTFIT_RAMPS.map((outfit) => ({
  light: outfit.shirt[0],
  main: outfit.shirt[1],
}));

/** Four typing frames on the approved seated matrix. Odd frames drop the desk hand 1 px. */
export function paintSit(appearance: Appearance = SIT_PILOT): Rgba[] {
  return sitFrames(appearance);
}
