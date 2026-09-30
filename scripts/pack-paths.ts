/**
 * The Tiny Farm sheets stay outside git. Cuts write crops into `.cache/tiny-farm/`.
 * The runtime and the render scripts read that cache, never a committed PNG.
 */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const CACHE = path.join(ROOT, '.cache/tiny-farm');

const APP_SUPPORT = path.join(
  process.env.HOME ?? '',
  'Library/Application Support/cursor-office-assets/tiny-farm/Farm RPG - Tiny Asset Pack - (All in One)',
);

/** Gitignored `Tiny Asset Pack*` in the repo, otherwise the local app-support copy. */
export function packRoot(): string {
  const local = fs.readdirSync(ROOT, { withFileTypes: true }).find((entry) =>
    entry.isDirectory() && entry.name.startsWith('Tiny Asset Pack'),
  );
  if (local) return path.join(ROOT, local.name);
  if (fs.existsSync(APP_SUPPORT)) return APP_SUPPORT;
  throw new Error(
    'Tiny Farm pack not found. Keep the sheets in a gitignored "Tiny Asset Pack*" folder and run npm run art:cut.',
  );
}
