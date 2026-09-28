import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  installHooks,
  previewInstall,
  uninstallHooks,
} from '../../src/main/cursor/hook-installer';
import { SUBSCRIBED_HOOKS } from '../../src/main/cursor/hook-config';

function tempDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-hooks-'));
  const cursorDir = path.join(root, '.cursor');
  const userData = path.join(root, 'userdata');
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.mkdirSync(userData, { recursive: true });
  const wrapperPath = path.join(root, 'cursor-hook.sh');
  fs.copyFileSync(
    path.resolve(__dirname, '../../resources/cursor-hook.sh'),
    wrapperPath,
  );
  fs.chmodSync(wrapperPath, 0o755);
  return {
    root,
    hooksJsonPath: path.join(cursorDir, 'hooks.json'),
    wrapperPath,
    userDataDir: userData,
  };
}

describe('hook installer', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it('fresh install creates valid schema-version-1 entries for subscribed hooks', () => {
    const paths = tempDirs();
    roots.push(paths.root);

    const preview = previewInstall(paths);
    expect(preview.hooks).toEqual([...SUBSCRIBED_HOOKS]);
    expect(preview.commandPath).toBe(paths.wrapperPath);
    expect(preview.retainedFields.length).toBeGreaterThan(0);

    const result = installHooks(paths);
    expect(result.ok).toBe(true);

    const written = JSON.parse(fs.readFileSync(paths.hooksJsonPath, 'utf8')) as {
      version: number;
      hooks: Record<string, Array<{ command: string }>>;
    };
    expect(written.version).toBe(1);
    for (const name of SUBSCRIBED_HOOKS) {
      expect(written.hooks[name]?.some((e) => e.command.includes('cursor-office-observer'))).toBe(
        true,
      );
    }
  });

  it('AE7: install and uninstall preserve unrelated hook entries', () => {
    const paths = tempDirs();
    roots.push(paths.root);

    const unrelated = {
      version: 1,
      hooks: {
        beforeShellExecution: [{ command: 'echo unrelated-shell' }],
        postToolUse: [{ command: 'echo unrelated-post' }],
        sessionEnd: [{ command: 'echo unrelated-end' }],
      },
    };
    fs.writeFileSync(paths.hooksJsonPath, `${JSON.stringify(unrelated, null, 2)}\n`);

    expect(installHooks(paths).ok).toBe(true);
    const mid = JSON.parse(fs.readFileSync(paths.hooksJsonPath, 'utf8')) as typeof unrelated;
    expect(mid.hooks.beforeShellExecution).toEqual(unrelated.hooks.beforeShellExecution);
    expect(mid.hooks.sessionEnd).toEqual(unrelated.hooks.sessionEnd);
    expect(mid.hooks.postToolUse?.map((e) => e.command)).toContain('echo unrelated-post');
    expect(mid.hooks.postToolUse?.some((e) => e.command.includes('cursor-office-observer'))).toBe(
      true,
    );

    expect(uninstallHooks(paths).ok).toBe(true);
    const after = JSON.parse(fs.readFileSync(paths.hooksJsonPath, 'utf8')) as typeof unrelated;
    expect(after.hooks.beforeShellExecution).toEqual(unrelated.hooks.beforeShellExecution);
    expect(after.hooks.sessionEnd).toEqual(unrelated.hooks.sessionEnd);
    expect(after.hooks.postToolUse).toEqual(unrelated.hooks.postToolUse);
    expect(JSON.stringify(after)).not.toContain('cursor-office-observer');
  });

  it('invalid or unknown hook configuration aborts without writing', () => {
    const paths = tempDirs();
    roots.push(paths.root);
    fs.writeFileSync(paths.hooksJsonPath, '{ not json');
    const before = fs.readFileSync(paths.hooksJsonPath, 'utf8');

    const result = installHooks(paths);
    expect(result.ok).toBe(false);
    expect(fs.readFileSync(paths.hooksJsonPath, 'utf8')).toBe(before);
  });

  it('aborts on unsupported version without writing', () => {
    const paths = tempDirs();
    roots.push(paths.root);
    const raw = `${JSON.stringify({ version: 99, hooks: {} }, null, 2)}\n`;
    fs.writeFileSync(paths.hooksJsonPath, raw);
    expect(installHooks(paths).ok).toBe(false);
    expect(fs.readFileSync(paths.hooksJsonPath, 'utf8')).toBe(raw);
  });
});
