import { getPixel, setPixel, type Rgba } from './png';

/**
 * The Tiny Farm computer is one static sprite. Its glass is the dark purple
 * fill plus the two marks already drawn on that glass. Lit states reuse the
 * keyboard blues from the same sprite: no new colors, no new shapes.
 */
const GLASS = new Set([0x0a0514, 0x57668a, 0x1f233f]);
const SEED = 0x57668a;
const KEY = 0x005ba7;
const BRIGHT = 0x0092dd;
const DIM = 0x1f233f;

export interface ScreenPixel {
  x: number;
  y: number;
}

/** Pixels of the monitor glass, found from the reflection mark and flooded through the dark fill. */
export function screenGlass(img: Rgba): ScreenPixel[] {
  const seeds: ScreenPixel[] = [];
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (getPixel(img, x, y) === SEED) seeds.push({ x, y });
    }
  }
  const seen = new Set<string>();
  const glass: ScreenPixel[] = [];
  const stack = [...seeds];
  while (stack.length > 0) {
    const pixel = stack.pop()!;
    const key = `${pixel.x},${pixel.y}`;
    if (seen.has(key)) continue;
    if (!GLASS.has(getPixel(img, pixel.x, pixel.y))) continue;
    seen.add(key);
    glass.push(pixel);
    stack.push(
      { x: pixel.x + 1, y: pixel.y },
      { x: pixel.x - 1, y: pixel.y },
      { x: pixel.x, y: pixel.y + 1 },
      { x: pixel.x, y: pixel.y - 1 },
    );
  }
  return glass;
}

export function monitorScreens(base: Rgba): { working: Rgba; standby: Rgba } {
  const glass = screenGlass(base);
  if (glass.length === 0) throw new Error('computer crop has no screen glass');
  return {
    working: paint(base, glass, KEY, BRIGHT),
    standby: paint(base, glass, DIM, KEY),
  };
}

/** Body fill, with the top-left corner of the glass kept as a shine. */
function paint(base: Rgba, glass: readonly ScreenPixel[], fill: number, shine: number): Rgba {
  const out: Rgba = { width: base.width, height: base.height, data: new Uint8Array(base.data) };
  const top = Math.min(...glass.map((pixel) => pixel.y));
  const left = Math.min(...glass.map((pixel) => pixel.x));
  for (const pixel of glass) {
    const lit = pixel.y <= top + 1 && pixel.x <= left + 2;
    setPixel(out, pixel.x, pixel.y, lit ? shine : fill);
  }
  return out;
}
