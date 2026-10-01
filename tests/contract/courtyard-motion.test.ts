import { describe, expect, it } from 'vitest';
import { BUTTERFLY_WANDER, butterflyFlights, butterflyPose, glideToward } from '../../src/renderer/office/butterflies';
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

  const blocked = (x: number) => x > 180 && x < 210;

  it('homes each butterfly on an open flower, kept apart', () => {
    const flights = butterflyFlights(perches, blocked);
    expect(flights.length).toBeGreaterThan(0);
    expect(flights.length).toBeLessThanOrEqual(5);
    const homes = flights.map((flight) => flight.home);
    expect(homes.some((home) => blocked(home.x))).toBe(false);
    for (let i = 0; i < homes.length; i += 1) {
      for (let j = i + 1; j < homes.length; j += 1) {
        expect(Math.hypot(homes[i]!.x - homes[j]!.x, homes[i]!.y - homes[j]!.y)).toBeGreaterThanOrEqual(160);
      }
    }
    const still = butterflyPose(flights[0]!, 5000, true);
    expect(still).toEqual({ x: homes[0]!.x, y: homes[0]!.y, frame: 0 });
  });

  it('flies slowly, never faster than a butterfly should', () => {
    for (const flight of butterflyFlights(perches, blocked)) {
      let last = butterflyPose(flight, 0, false);
      for (let ms = 50; ms < flight.periodMs * 2; ms += 50) {
        const pose = butterflyPose(flight, ms, false);
        expect(Math.hypot(pose.x - last.x, pose.y - last.y)).toBeLessThan(2);
        last = pose;
      }
    }
  });

  it('wanders in random directions near home instead of a fixed loop', () => {
    const [flight] = butterflyFlights(perches, blocked);
    const headings = new Set<string>();
    for (const leg of flight!.legs) {
      expect(Math.hypot(leg.to.x - flight!.home.x, leg.to.y - flight!.home.y)).toBeLessThanOrEqual(BUTTERFLY_WANDER + 1);
      expect(blocked(leg.to.x)).toBe(false);
      const dx = Math.sign(leg.to.x - leg.from.x);
      const dy = Math.sign(leg.to.y - leg.from.y);
      if (dx || dy) headings.add(`${dx},${dy}`);
    }
    expect(headings.size).toBeGreaterThanOrEqual(4);
    const pauses = new Set(flight!.legs.map((leg) => leg.pauseMs));
    expect(pauses.size).toBeGreaterThan(flight!.legs.length / 2);
  });

  it('glides a scared butterfly instead of teleporting it', () => {
    const next = glideToward({ x: 0, y: 0 }, { x: 48, y: 0 }, 100, 28);
    expect(next.x).toBeCloseTo(2.8);
    expect(glideToward({ x: 0, y: 0 }, { x: 1, y: 0 }, 100, 28)).toEqual({ x: 1, y: 0 });
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
