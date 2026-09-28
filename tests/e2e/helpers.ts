import { _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function launchIsolatedApp(): Promise<{
  app: ElectronApplication;
  page: Page;
  root: string;
  hooksJsonPath: string;
  userData: string;
}> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-e2e-'));
  const cursorDir = path.join(root, '.cursor');
  const userData = path.join(root, 'userdata');
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.mkdirSync(userData, { recursive: true });
  const hooksJsonPath = path.join(cursorDir, 'hooks.json');
  const wrapperPath = path.resolve(__dirname, '../../resources/cursor-hook.sh');

  // Seed unrelated hooks to prove additive install.
  fs.writeFileSync(
    hooksJsonPath,
    `${JSON.stringify(
      {
        version: 1,
        hooks: {
          sessionEnd: [{ command: 'echo unrelated-session-end' }],
        },
      },
      null,
      2,
    )}\n`,
  );

  const app = await electron.launch({
    args: ['.'],
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      CURSOR_OFFICE_USER_DATA: userData,
      CURSOR_OFFICE_HOOKS_PATH: hooksJsonPath,
      CURSOR_OFFICE_WRAPPER_PATH: wrapperPath,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page, root, hooksJsonPath, userData };
}

export function cleanupRoot(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}
