import { describe, expect, it } from 'vitest';
import { MapCamera } from '../../src/renderer/office/camera';
import { WORLD } from '../../src/renderer/office/landmarks';

describe('map camera', () => {
  it('fits with the largest integer scale that fits and accepts a margin', () => {
    const camera = new MapCamera();
    camera.fit(2700, 1600, WORLD.width, WORLD.height);
    expect(camera.scale).toBe(2);
    expect(Number.isInteger(camera.x)).toBe(true);
    expect(Number.isInteger(camera.y)).toBe(true);
    expect(camera.x).toBe(Math.round((2700 - WORLD.width * 2) / 2));

    camera.fit(900, 600, WORLD.width, WORLD.height);
    expect(camera.scale).toBe(1);
  });

  it('zooms in integer steps and keeps the point under the cursor', () => {
    const camera = new MapCamera();
    camera.fit(1400, 900, WORLD.width, WORLD.height);
    expect(camera.scale).toBe(1);
    const screenX = 700;
    const screenY = 450;
    const worldX = (screenX - camera.x) / camera.scale;
    const worldY = (screenY - camera.y) / camera.scale;
    camera.zoomStep(screenX, screenY, 1);
    expect(camera.scale).toBe(2);
    expect(Math.abs((screenX - camera.x) / camera.scale - worldX)).toBeLessThanOrEqual(0.5);
    expect(Math.abs((screenY - camera.y) / camera.scale - worldY)).toBeLessThanOrEqual(0.5);
    for (let i = 0; i < 6; i += 1) camera.zoomStep(screenX, screenY, 1);
    expect(camera.scale).toBe(4);
    for (let i = 0; i < 6; i += 1) camera.zoomStep(screenX, screenY, -1);
    expect(camera.scale).toBe(1);
    camera.pan(3.4, -2.6);
    expect(Number.isInteger(camera.x)).toBe(true);
    expect(Number.isInteger(camera.y)).toBe(true);
  });
});
