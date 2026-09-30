import { describe, expect, it } from 'vitest';
import { butterflyFlights, butterflyPose } from '../../src/renderer/office/butterflies';
import { claimBeds, gardenAction, initialGarden, stepGarden, STAGE_MS, TILL_MS, PLANT_MS, WATER_MS, HARVEST_MS } from '../../src/renderer/office/garden-cycle';
import { lilyFrame, lilyOffsetY, LILY_FRAMES } from '../../src/renderer/office/lily-motion';

describe('butterfly routes', () => {
  const perches = [
    { x: 40, y: 40 },
    { x: 120, y: 48 },
    { x: 200, y: 60 },
    { x: 40, y: 160 },
    { x: 130, y: 170 },
    { x: 220, y: 180 },
  ];

  it('builds separated routes that skip blocked perches and stay apart', () => {
    const flights = butterflyFlights(perches, (x) => x > 180 && x < 210);
    expect(flights.length).toBeGreaterThan(0);
    expect(flights.length).toBeLessThanOrEqual(4);
    const points = flights.flatMap((flight) => flight.points);
    expect(points.some((point) => point.x > 180 && point.x < 210)).toBe(false);
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        expect(Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y)).toBeGreaterThanOrEqual(64);
      }
    }
    const still = butterflyPose(flights[0]!, 5000, true);
    expect(still).toEqual({ x: flights[0]!.points[0]!.x, y: flights[0]!.points[0]!.y, frame: 0 });
    const moving = butterflyPose(flights[0]!, 0, false);
    expect(moving.frame).toBe(0);
    expect(moving.x).toBe(flights[0]!.points[0]!.x);
  });
});

describe('lily pad motion', () => {
  it('stays on a pack frame and within a one pixel bob', () => {
    for (const pad of [0, 1, 4]) {
      const frame = lilyFrame(pad, 2000, false);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(LILY_FRAMES);
      const bob = lilyOffsetY(pad, 2000, false);
      expect(bob === 0 || bob === -1).toBe(true);
    }
    expect(lilyFrame(2, 9000, true)).toBe(0);
    expect(lilyOffsetY(2, 9000, true)).toBe(0);
    expect(lilyFrame(0, 100, false)).toBe(lilyFrame(0, 100, false));
  });
});

describe('garden cycle', () => {
  it('tills, plants, waters, grows, then harvests back to soil', () => {
    let state = initialGarden();
    expect(gardenAction(state.phase)).toBe('hoe');
    state = stepGarden(state, TILL_MS, true, false);
    expect(state.phase).toBe('plant');
    expect(gardenAction(state.phase)).toBe('sit');
    state = stepGarden(state, PLANT_MS, true, false);
    expect(state.phase).toBe('water');
    expect(gardenAction(state.phase)).toBe('water');
    state = stepGarden(state, WATER_MS, true, false);
    expect(state).toMatchObject({ phase: 'grow', stage: 1 });
    state = stepGarden(state, STAGE_MS, true, false);
    expect(state.stage).toBe(2);
    state = stepGarden(state, STAGE_MS, true, false);
    expect(state.stage).toBe(3);
    state = stepGarden(state, STAGE_MS, true, false);
    expect(state.phase).toBe('harvest');
    state = stepGarden(state, HARVEST_MS, true, false);
    expect(state).toMatchObject({ phase: 'till', stage: 0 });
  });

  it('gives each consultant a different bed and holds a ripe bed when motion is reduced', () => {
    const beds = [{ col: 1, row: 1 }, { col: 4, row: 1 }];
    const claimed = claimBeds(['b', 'a', 'c'], beds);
    expect(claimed.get('a')).toEqual(beds[0]);
    expect(claimed.get('b')).toEqual(beds[1]);
    expect(claimed.has('c')).toBe(false);
    expect(stepGarden(initialGarden(), 50, true, true)).toEqual({ phase: 'grow', stage: 3, phaseMs: 0 });
  });
});
