/**
 * Regenerate every Tiny Farm crop into `.cache/tiny-farm/`.
 *   npm run art:cut
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STEPS = [
  'scripts/cut-tiny-farm.ts',
  'scripts/cut-shores.ts',
  'scripts/cut-tufts.ts',
  'scripts/cut-decals.ts',
  'scripts/cut-courtyard.ts',
  'scripts/cut-cabin.ts',
];

for (const step of STEPS) {
  const result = spawnSync('npx', ['vite-node', step], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
