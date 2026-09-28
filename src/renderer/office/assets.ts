import { Graphics } from 'pixi.js';

/** Procedural office furniture — no external raster assets required for MVP. */
export function createFloor(width: number, height: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, width, height);
  g.fill({ color: 0xd7e2ec });
  // Subtle plank lines
  g.setStrokeStyle({ width: 1, color: 0xc5d2e0, alpha: 0.8 });
  for (let y = 40; y < height; y += 28) {
    g.moveTo(0, y);
    g.lineTo(width, y);
    g.stroke();
  }
  return g;
}

export function createDesk(x: number, y: number, hue: number): Graphics {
  const color = hslToHex(hue, 0.35, 0.45);
  const g = new Graphics();
  g.roundRect(x - 34, y + 10, 68, 18, 3);
  g.fill({ color });
  g.roundRect(x - 30, y - 8, 60, 22, 2);
  g.fill({ color: 0xf2f5f8 });
  return g;
}

export function createNpcAvatar(hue: number, radius = 14): Graphics {
  const g = new Graphics();
  g.circle(0, 0, radius);
  g.fill({ color: hslToHex(hue, 0.55, 0.55) });
  g.circle(-4, -2, 2.2);
  g.circle(4, -2, 2.2);
  g.fill({ color: 0x1c2430 });
  return g;
}

export function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) => Math.round((v + m) * 255);
  return (to(r) << 16) + (to(g) << 8) + to(b);
}
