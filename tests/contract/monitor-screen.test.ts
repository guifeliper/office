import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPixel, readPng } from '../../scripts/png';
import { monitorScreens, screenGlass } from '../../scripts/monitor-screen';

const computer = readPng(path.join(process.cwd(), '.cache/tiny-farm/cabin/computer.png'));

describe('monitor screen', () => {
  const glass = screenGlass(computer);
  const { working, standby } = monitorScreens(computer);
  const glassKeys = new Set(glass.map((pixel) => `${pixel.x},${pixel.y}`));

  it('recolors only the glass, using blues already on the keyboard', () => {
    expect(glass.length).toBeGreaterThan(40);
    for (let y = 0; y < computer.height; y += 1) {
      for (let x = 0; x < computer.width; x += 1) {
        const before = getPixel(computer, x, y);
        if (glassKeys.has(`${x},${y}`)) {
          expect([0x005ba7, 0x0092dd]).toContain(getPixel(working, x, y));
          expect([0x1f233f, 0x005ba7]).toContain(getPixel(standby, x, y));
        } else {
          expect(getPixel(working, x, y)).toBe(before);
          expect(getPixel(standby, x, y)).toBe(before);
        }
      }
    }
  });

  it('keeps a bright corner on the working screen and a dim body on standby', () => {
    const bright = glass.filter((pixel) => getPixel(working, pixel.x, pixel.y) === 0x0092dd);
    const dim = glass.filter((pixel) => getPixel(standby, pixel.x, pixel.y) === 0x1f233f);
    expect(bright.length).toBeGreaterThan(0);
    expect(bright.length).toBeLessThan(glass.length / 2);
    expect(dim.length).toBeGreaterThan(glass.length / 2);
  });
});
