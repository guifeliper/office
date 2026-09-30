import { cabinDoorRect } from './cabin-layout';
import { lodgeRect } from './world-layout';

/**
 * Which scene the viewer is looking at. Renderer state only: switching never touches
 * presence, desk assignment, or the domain projection.
 */
export type SceneId = 'cabin' | 'yard';

/** The app opens inside the cabin. */
export const START_SCENE: SceneId = 'cabin';

/** Click is in world pixels of the scene currently shown. */
export type SceneInput = { kind: 'escape' } | { kind: 'click'; x: number; y: number };

function inside(r: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** True over the thing that switches scene: the lodge outside, the door inside. */
export function portalAt(scene: SceneId, x: number, y: number): boolean {
  return scene === 'yard' ? inside(lodgeRect(), x, y) : inside(cabinDoorRect(), x, y);
}

export function nextScene(current: SceneId, input: SceneInput): SceneId {
  if (input.kind === 'escape') return 'yard';
  if (!portalAt(current, input.x, input.y)) return current;
  return current === 'yard' ? 'cabin' : 'yard';
}
