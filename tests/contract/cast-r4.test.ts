import { describe, expect, it } from 'vitest';
import { paintMatrix } from '../../scripts/body-art';
import { armSwing, checkCombinations, shoeGap, shoeRise } from '../../scripts/frame-check';
import { STILL, walkMatrix } from '../../src/renderer/office/cast';
import type { Facing } from '../../src/renderer/office/paper-doll';

const FACINGS: Facing[] = ['south', 'north', 'east', 'west'];

describe('round 4 walk', () => {
  it('raises the sole at least 4 px, separates the contact feet, and swings the arm at least 2', () => {
    for (const facing of FACINGS) {
      const still = paintMatrix(STILL[facing]);
      for (let frame = 0; frame < 6; frame += 1) {
        const painted = paintMatrix(walkMatrix(facing, frame));
        expect(shoeRise(painted), `${facing} ${frame} pé`).toBeGreaterThanOrEqual(4);
        expect(armSwing(still, painted), `${facing} ${frame} braço`).toBeGreaterThanOrEqual(2);
        if (frame === 0 || frame === 3) expect(shoeGap(painted), `${facing} ${frame} vão`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('keeps all 4800 looks on the new frames', () => {
    const result = checkCombinations();
    expect(result.looks).toBe(4800);
    expect(result.failed).toEqual([]);
  }, 20_000);
});
