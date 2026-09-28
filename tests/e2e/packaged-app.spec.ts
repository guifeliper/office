import { expect, test } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FORBIDDEN_STRINGS, SENSITIVE_FIXTURE } from '../fixtures/cursor-hooks';
import { installHooks } from '../../src/main/cursor/hook-installer';
import { responseForHook } from '../../src/main/cursor/hook-config';

/**
 * Playwright's Electron driver needs inspect/debug switches.
 * This app disables EnableNodeCliInspectArguments via Electron fuses for hardening,
 * so CDP attach to the packaged binary hangs. We therefore smoke-test the packaged
 * artifact via process spawn + loopback ingest instead of Playwright windows.
 */
function packagedExecutable(): string | null {
  const appPath = path.resolve(
    __dirname,
    '../../out/Cursor Office-darwin-arm64/Cursor Office.app/Contents/MacOS/Cursor Office',
  );
  return fs.existsSync(appPath) ? appPath : null;
}

function packagedWrapper(): string | null {
  const wrapper = path.resolve(
    __dirname,
    '../../out/Cursor Office-darwin-arm64/Cursor Office.app/Contents/Resources/resources/cursor-hook.sh',
  );
  return fs.existsSync(wrapper) ? wrapper : null;
}

async function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

test.describe('packaged app', () => {
  test('packaged resources install wrapper and ingest without leaking secrets', async () => {
    const executable = packagedExecutable();
    const wrapper = packagedWrapper();
    test.skip(!executable || !wrapper, 'Packaged app missing — run electron-forge package first');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-pkg-'));
    const userData = path.join(root, 'userdata');
    const hooksJsonPath = path.join(root, '.cursor', 'hooks.json');
    fs.mkdirSync(path.dirname(hooksJsonPath), { recursive: true });
    fs.writeFileSync(
      hooksJsonPath,
      `${JSON.stringify({ version: 1, hooks: { sessionEnd: [{ command: 'echo keep' }] } }, null, 2)}\n`,
    );

    const child = spawn(executable!, [], {
      env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        CURSOR_OFFICE_USER_DATA: userData,
        CURSOR_OFFICE_HOOKS_PATH: hooksJsonPath,
      },
      stdio: 'ignore',
    });

    try {
      await waitForFile(path.join(userData, 'ingest.port'), 15_000);
      await waitForFile(path.join(userData, 'ingest.token'), 15_000);
      await waitForFile(path.join(userData, 'office.sqlite'), 15_000);

      const install = installHooks({
        hooksJsonPath,
        wrapperPath: wrapper!,
        userDataDir: userData,
      });
      expect(install.ok).toBe(true);

      const staged = path.join(userData, 'cursor-hook.sh');
      expect(fs.existsSync(staged)).toBe(true);
      const hooks = fs.readFileSync(hooksJsonPath, 'utf8');
      expect(hooks).toContain('cursor-office-observer');
      expect(hooks).toContain(staged);
      expect(hooks).toContain('echo keep');

      const token = fs.readFileSync(path.join(userData, 'ingest.token'), 'utf8').trim();
      const port = fs.readFileSync(path.join(userData, 'ingest.port'), 'utf8').trim();
      const res = await fetch(`http://127.0.0.1:${port}/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Cursor-Office-Hook': 'preToolUse',
        },
        body: JSON.stringify(SENSITIVE_FIXTURE),
      });
      expect(res.status).toBe(204);

      const bytes = fs.readFileSync(path.join(userData, 'office.sqlite'));
      for (const secret of FORBIDDEN_STRINGS) {
        expect(bytes.includes(Buffer.from(secret))).toBe(false);
      }

      // App unavailable / dead port: wrapper remains fail-open.
      fs.writeFileSync(path.join(userData, 'ingest.port'), '1', 'utf8');
      const result = spawnSync('bash', [staged, 'stop'], {
        input: '{}',
        env: {
          ...process.env,
          CURSOR_OFFICE_TOKEN_FILE: path.join(userData, 'ingest.token'),
          CURSOR_OFFICE_PORT_FILE: path.join(userData, 'ingest.port'),
          CURSOR_OFFICE_TIMEOUT_SECS: '1',
        },
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(responseForHook('stop'));
    } finally {
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 300));
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
