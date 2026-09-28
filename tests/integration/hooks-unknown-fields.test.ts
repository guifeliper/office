import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { installHooks, uninstallHooks } from '../../src/main/cursor/hook-installer';

describe('hooks.json unknown top-level fields', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it('preserves unknown top-level keys across install and uninstall', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-hooks-extra-'));
    roots.push(root);
    const cursorDir = path.join(root, '.cursor');
    const userData = path.join(root, 'userdata');
    fs.mkdirSync(cursorDir, { recursive: true });
    fs.mkdirSync(userData, { recursive: true });
    const wrapperPath = path.join(root, 'cursor-hook.sh');
    fs.copyFileSync(path.resolve(__dirname, '../../resources/cursor-hook.sh'), wrapperPath);
    fs.chmodSync(wrapperPath, 0o755);
    const hooksJsonPath = path.join(cursorDir, 'hooks.json');

    const original = {
      version: 1,
      hooks: {
        sessionEnd: [{ command: 'echo keep-me' }],
      },
      experimental: { featureFlag: true },
      _comment: 'user metadata',
    };
    fs.writeFileSync(hooksJsonPath, `${JSON.stringify(original, null, 2)}\n`, { mode: 0o644 });

    expect(
      installHooks({ hooksJsonPath, wrapperPath, userDataDir: userData }).ok,
    ).toBe(true);

    const mid = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8')) as typeof original & {
      hooks: Record<string, Array<{ command: string }>>;
    };
    expect(mid.experimental).toEqual({ featureFlag: true });
    expect(mid._comment).toBe('user metadata');
    expect(mid.hooks.sessionEnd).toEqual(original.hooks.sessionEnd);
    expect(JSON.stringify(mid.hooks)).toContain('cursor-office-observer');

    expect(uninstallHooks({ hooksJsonPath, wrapperPath, userDataDir: userData }).ok).toBe(true);
    const after = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8')) as typeof original;
    expect(after.experimental).toEqual({ featureFlag: true });
    expect(after._comment).toBe('user metadata');
    expect(after.hooks.sessionEnd).toEqual(original.hooks.sessionEnd);
    expect(JSON.stringify(after)).not.toContain('cursor-office-observer');
  });
});
