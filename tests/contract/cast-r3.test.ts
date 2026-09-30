import { describe, expect, it } from 'vitest';
import { checkAllFrames, checkCatalog, checkRecolor } from '../../scripts/frame-check';
import { alphaMask, leisureFrames, sitFrames, walkFrames } from '../../src/renderer/office/cast';
import { WALK_FRAME_MS } from '../../src/renderer/office/consultant-view';

describe('round 3 frames', () => {
  it('passes the checker on every still, walk, sit and leisure frame', () => {
    const frames = checkAllFrames();
    const failed = frames.filter((item) => !item.pass);
    expect(failed.map((item) => `${item.name}: ${item.detail}`)).toEqual([]);
  });

  it('keeps hue, outfit contrast, and a recolor that does not move pixels', () => {
    const catalog = checkCatalog().filter((item) => !item.pass);
    const masks = checkRecolor().filter((item) => !item.pass);
    expect(catalog.map((item) => item.name)).toEqual([]);
    expect(masks.map((item) => item.name)).toEqual([]);
  });

  it('walks in 6 frames at the current step, and west mirrors east', () => {
    expect(WALK_FRAME_MS).toBe(110);
    expect(walkFrames('south')).toHaveLength(6);
    expect(alphaMask(walkFrames('south')[0]!)).not.toBe(alphaMask(walkFrames('south')[2]!));
    const mirror = checkRecolor().filter((item) => item.name.startsWith('espelho') && !item.pass);
    expect(mirror).toEqual([]);
  });

  it('types in 4 frames, and leisure keeps row 56 empty', () => {
    const sits = sitFrames();
    expect(sits).toHaveLength(4);
    expect(alphaMask(sits[0]!)).not.toBe(alphaMask(sits[1]!));
    expect(alphaMask(sits[0]!)).toBe(alphaMask(sits[2]!));
    const leisure = leisureFrames();
    expect(leisure.campfire).toHaveLength(4);
    expect(leisure.woodpile).toHaveLength(4);
    expect(leisure.garden).toHaveLength(3);
    for (const frames of Object.values(leisure)) {
      for (const frame of frames) {
        for (let x = 0; x < 48; x += 1) expect(frame.data[(56 * 48 + x) * 4 + 3]).toBe(0);
      }
    }
  });
});
