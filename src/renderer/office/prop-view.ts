import { Sprite, type Texture } from 'pixi.js';
import { canopyDepth, depthFromFeet, foregroundDepth } from './depth';
import { PROP_SPECS, bushVariant, canopyLineY, canopyVariant, propBase, type PropKind, type PropPlacement } from './world-layout';

export type PropTextures = Record<PropKind, { base: Texture; foreground?: Texture }>;

/**
 * One base sprite per placement, anchored bottom-center on its span and sorted by that base.
 * Tall props add a top sprite: a canopy sorts by its own bottom line, an overhead piece
 * (lintel) sorts above every walker.
 */
export function createPropSprites(
  placements: readonly PropPlacement[],
  textures: PropTextures,
  variants?: { canopies?: readonly Texture[]; bushes?: readonly Texture[] },
): Sprite[] {
  const sprites: Sprite[] = [];
  for (const placement of placements) {
    const art = textures[placement.kind];
    const { x, y } = propBase(placement);
    const baseTexture = placement.kind === 'bush' && variants?.bushes?.length
      ? variants.bushes[bushVariant(placement.col, placement.row) % variants.bushes.length]!
      : art.base;
    const topTexture = placement.kind === 'tree' && variants?.canopies?.length
      ? variants.canopies[canopyVariant(placement.col, placement.row) % variants.canopies.length]
      : art.foreground;

    const base = new Sprite(baseTexture);
    base.anchor.set(0.5, 1);
    base.roundPixels = true;
    base.eventMode = 'none';
    base.position.set(Math.round(x), y);
    base.zIndex = depthFromFeet(y);
    base.label = placement.kind;
    sprites.push(base);

    const sort = PROP_SPECS[placement.kind].foreground;
    if (topTexture && sort !== 'none') {
      const top = new Sprite(topTexture);
      top.anchor.set(0.5, 1);
      top.roundPixels = true;
      top.eventMode = 'none';
      if (sort === 'canopy') {
        const line = canopyLineY(placement);
        top.position.set(Math.round(x), line + 1);
        top.zIndex = canopyDepth(line);
      } else {
        top.position.set(Math.round(x), y - art.base.height);
        top.zIndex = foregroundDepth(y);
      }
      sprites.push(top);
    }
  }
  return sprites;
}
