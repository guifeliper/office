/**
 * Fail if any tracked file still carries Tiny Farm pixels.
 *   npx vite-node scripts/prove-pack-not-tracked.ts
 *
 * Pack grass is 7ec433 / 54b033. Pack water is 0092dd. Handmade Daylit art uses the ramp, not these.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './png';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK_GREEN = 0x7ec433;
const PACK_DARK = 0x54b033;
const PACK_WATER = 0x0092dd;
const HEX_RUN = '7ec4337ec4337ec433';

const FORBIDDEN = [
  /^src\/renderer\/office\/art\/yard\//,
  /^src\/renderer\/office\/art\/cabin\//,
  /^src\/renderer\/office\/art\/cast\//,
  /^src\/renderer\/office\/art\/tiles\//,
  /^src\/renderer\/office\/art\/props\/tree-(trunk|canopy)\.png$/,
  /^docs\/design\/tiny-farm\/.+\.png$/,
  /^docs\/design\/interior\/cabin-.*\.png$/,
];

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString('utf8').split('\0').filter(Boolean);
const failures: string[] = [];

for (const file of tracked) {
  if (FORBIDDEN.some((rule) => rule.test(file))) failures.push(`tracked pack path: ${file}`);
}

for (const file of tracked) {
  if (!/\.(ts|tsx|js|mjs|md|css|json|html)$/.test(file)) continue;
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (text.includes(HEX_RUN)) failures.push(`embedded pack pixels: ${file}`);
}

for (const file of tracked.filter((name) => name.endsWith('.png'))) {
  const abs = path.join(ROOT, file);
  const magic = fs.readFileSync(abs).subarray(0, 8);
  if (magic[0] !== 0x89 || magic.toString('ascii', 1, 4) !== 'PNG') continue;
  let img;
  try {
    img = readPng(abs);
  } catch (error) {
    failures.push(`unreadable png: ${file} (${error instanceof Error ? error.message : 'error'})`);
    continue;
  }
  let hits = 0;
  for (let i = 0; i < img.width * img.height; i += 1) {
    if (img.data[i * 4 + 3] === 0) continue;
    const color = (img.data[i * 4]! << 16) | (img.data[i * 4 + 1]! << 8) | img.data[i * 4 + 2]!;
    if (color === PACK_GREEN || color === PACK_DARK || color === PACK_WATER) hits += 1;
  }
  if (hits > 32) failures.push(`pack colors in ${file} (${hits})`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.warn(`clean: ${tracked.length} tracked files, no pack pixels`);
