const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * View transform only. Zoom and pan never touch office domain state.
 * Scale is always an integer so nearest-neighbor keeps the closed ramp: a fractional fit
 * blended every tile edge (6115 colors in QA). Fit takes the largest integer that fits
 * and accepts a margin; below 1 the view keeps 1× and the map pans.
 */
export class MapCamera {
  x = 0;
  y = 0;
  scale = 1;

  fit(viewWidth: number, viewHeight: number, worldWidth: number, worldHeight: number): void {
    if (viewWidth <= 0 || viewHeight <= 0 || worldWidth <= 0 || worldHeight <= 0) return;
    const fits = Math.floor(Math.min(viewWidth / worldWidth, viewHeight / worldHeight));
    this.scale = clamp(fits, MIN_SCALE, MAX_SCALE);
    this.x = Math.round((viewWidth - worldWidth * this.scale) / 2);
    this.y = Math.round((viewHeight - worldHeight * this.scale) / 2);
  }

  pan(dx: number, dy: number): void {
    this.x = Math.round(this.x + dx);
    this.y = Math.round(this.y + dy);
  }

  /** Moves one integer step, keeping the world point under (screenX, screenY). */
  zoomStep(screenX: number, screenY: number, direction: 1 | -1): void {
    const next = clamp(Math.round(this.scale) + direction, MIN_SCALE, MAX_SCALE);
    if (next === this.scale) return;
    const worldX = (screenX - this.x) / this.scale;
    const worldY = (screenY - this.y) / this.scale;
    this.scale = next;
    this.x = Math.round(screenX - worldX * next);
    this.y = Math.round(screenY - worldY * next);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
