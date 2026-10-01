import { describe, expect, it } from 'vitest';
import { paintMatrix } from '../../scripts/body-art';
import { checkFrame } from '../../scripts/frame-check';
import { alphaMask, typingMatrix } from '../../src/renderer/office/cast';
import { type Rgba } from '../../src/renderer/office/paper-doll';
import { INK, SIT_ANCHOR_ROW, SIT_SHIRT, paintChair, paintSit } from '../../src/renderer/office/station-art';

function px(img: Rgba, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return -1;
  const o = (y * img.width + x) * 4;
  if (img.data[o + 3] === 0) return -1;
  return (img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!;
}

const lum = (c: number) => 0.2126 * ((c >>> 16) & 0xff) + 0.7152 * ((c >>> 8) & 0xff) + 0.0722 * (c & 0xff);

describe('workstation chair', () => {
  const chair = paintChair();

  it('draws 16×14 with no ink across the top and an open back', () => {
    let top = 16;
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) if (px(chair, x, y) >= 0) top = Math.min(top, y);
    expect(top).toBe(2);
    for (let x = 1; x < 15; x += 1) expect(px(chair, x, 2)).not.toBe(INK);
    for (let y = 6; y <= 13; y += 1) for (let x = 3; x <= 12; x += 1) expect(px(chair, x, y)).toBe(-1);
    expect(px(chair, 8, 2)).toBe(0xe6c49a);
    expect(px(chair, 8, 4)).toBe(0xc4925a);
    expect(px(chair, 1, 10)).toBe(0x8a5a30);
    expect(px(chair, 8, 15)).toBe(0x4a3018);
  });
});

describe('seated north body', () => {
  it('keeps every shirt tone ≥ 40 luminance from both chair woods', () => {
    for (const shirt of SIT_SHIRT) {
      for (const tone of [shirt.light, shirt.main]) {
        expect(Math.abs(lum(tone) - lum(0xe6c49a))).toBeGreaterThanOrEqual(40);
        expect(Math.abs(lum(tone) - lum(0xc4925a))).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('ends on the seat, leaves row 56 empty, and passes the checker', () => {
    const frames = paintSit();
    expect(frames).toHaveLength(4);
    for (let frame = 0; frame < 4; frame += 1) {
      const result = checkFrame(`sit ${frame}`, paintMatrix(typingMatrix(frame)), 'seat');
      expect(result.detail).toBe('ok');
      for (let x = 0; x < 48; x += 1) expect(px(frames[frame]!, x, SIT_ANCHOR_ROW)).toBe(-1);
      for (let i = 3; i < frames[frame]!.data.length; i += 4) {
        expect(frames[frame]!.data[i] === 0 || frames[frame]!.data[i] === 255).toBe(true);
      }
    }
    let maxY = -1;
    for (let y = 0; y < 68; y += 1) for (let x = 0; x < 48; x += 1) if (px(frames[0]!, x, y) >= 0) maxY = y;
    expect(maxY).toBe(SIT_ANCHOR_ROW - 1);
    expect(px(frames[0]!, 20, 30)).not.toBe(INK);
  });

  it('drops the desk hand on odd frames', () => {
    const frames = paintSit();
    expect(alphaMask(frames[1]!)).not.toBe(alphaMask(frames[0]!));
    expect(alphaMask(frames[3]!)).toBe(alphaMask(frames[1]!));
    expect(alphaMask(frames[2]!)).toBe(alphaMask(frames[0]!));
  });
});
