import { describe, expect, it } from 'vitest';
import { FISH_PHASE_MS, fishFrame, initialFish, stepFish } from '../../src/renderer/office/fish-cycle';

describe('fishing cycle', () => {
  it('walks cast → wait → bite → reel → catch → cast', () => {
    let state = initialFish();
    expect(state.phase).toBe('cast');
    for (const phase of ['cast', 'wait', 'bite', 'reel', 'catch'] as const) {
      expect(state.phase).toBe(phase);
      state = stepFish(state, FISH_PHASE_MS[phase], true, false);
    }
    expect(state.phase).toBe('cast');
  });

  it('holds the wait pose when motion is reduced or the consultant is walking', () => {
    const mid = stepFish(initialFish(), 200, true, false);
    expect(stepFish(mid, 5000, true, true)).toEqual({ phase: 'wait', phaseMs: 0 });
    expect(stepFish(mid, 5000, false, false)).toEqual({ phase: 'wait', phaseMs: 0 });
  });

  it('steps frames inside a phase and wraps', () => {
    expect(fishFrame('cast', 0)).toBe(0);
    expect(fishFrame('cast', 80)).toBe(1);
    expect(fishFrame('wait', 280 * 4)).toBe(0);
  });
});
