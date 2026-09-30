import { CABIN_WORLD } from './cabin-layout';
import { WORLD } from './landmarks';
import type { Zone } from './leisure';

/**
 * A body is drawn in the scene it occupies, and only inside that scene's rectangle.
 * Courtyard feet must not appear in the cabin's dark margin, or the reverse.
 */
export function visibleInScene(
  showing: Zone,
  body: { zone: Zone; x: number; y: number },
): boolean {
  if (body.zone !== showing) return false;
  const bounds = showing === 'cabin' ? CABIN_WORLD : WORLD;
  return body.x >= 0 && body.y >= 0 && body.x <= bounds.width && body.y <= bounds.height;
}
