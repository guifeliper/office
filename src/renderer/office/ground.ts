import { Sprite, Texture } from 'pixi.js';
import { GROUND_DEPTH } from './depth';
import { paintCell } from './ground-tiles';
import { COLS, ROWS, TILE } from './world-layout';

/**
 * Tile ground baked once into a 1280×720 texture, sampled nearest-neighbor.
 * No props here — anything a walker goes around or behind is a separate sprite.
 */
export function createGround(): Sprite {
  const width = COLS * TILE;
  const height = ROWS * TILE;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for the ground');
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const px = paintCell(c, r);
      if (!px) continue;
      for (let y = 0; y < TILE; y += 1) {
        for (let x = 0; x < TILE; x += 1) {
          const color = px[y * TILE + x]!;
          const i = ((r * TILE + y) * width + c * TILE + x) * 4;
          data[i] = (color >>> 16) & 0xff;
          data[i + 1] = (color >>> 8) & 0xff;
          data[i + 2] = color & 0xff;
          data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  const sprite = new Sprite(texture);
  sprite.eventMode = 'none';
  sprite.roundPixels = true;
  sprite.zIndex = GROUND_DEPTH;
  return sprite;
}
