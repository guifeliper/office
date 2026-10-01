/**
 * Draw order only. Pathfinding and collision do not read this.
 *
 * Y grows downward. A larger depth draws in front.
 * The key is the feet (or a prop's base), never the sprite center or top.
 */

/** Tile ground. Always behind every feet/base key, which are >= 0. */
export const GROUND_DEPTH = -1;

/**
 * Lintels and future roofs. Above every feet/base key in the world,
 * so a walker under an overhead piece is always covered by it.
 */
export const FOREGROUND_DEPTH = 100_000;

export function depthFromFeet(feetY: number): number {
  return feetY;
}

/** Overhead piece of a tall prop. Stays ordered by base among other foregrounds. */
export function foregroundDepth(baseY: number): number {
  return FOREGROUND_DEPTH + baseY;
}

/**
 * Canopy key from the Y of its last opaque row. The half step breaks the tie so feet
 * exactly on the line stay under the leaves; feet south of it draw in front.
 */
export function canopyDepth(canopyLineY: number): number {
  return canopyLineY + 0.5;
}

/** True when `feetYA` is lower on the screen than `feetYB`, so A draws in front. */
export function drawsInFront(feetYA: number, feetYB: number): boolean {
  return depthFromFeet(feetYA) > depthFromFeet(feetYB);
}
