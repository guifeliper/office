/** Lily pads use the four pack frames. Reduced motion holds frame 0. */

export const LILY_FRAMES = 4;
export const LILY_FRAME_MS = 480;

export function lilyFrame(pad: number, elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const phase = (Math.abs(pad) * 170) % LILY_FRAME_MS;
  return Math.floor((elapsedMs + phase) / LILY_FRAME_MS) % LILY_FRAMES;
}

/** No extra pixels. Frames already move the pad; the offset stays inside one pixel if a caller bobs. */
export function lilyOffsetY(pad: number, elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const phase = (Math.abs(pad) * 40) % 1200;
  const wave = Math.sin(((elapsedMs + phase) / 1200) * Math.PI * 2);
  return wave > 0.65 ? -1 : 0;
}
