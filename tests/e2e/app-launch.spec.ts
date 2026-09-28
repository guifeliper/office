import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';

/**
 * Launch smoke for the secure desktop shell.
 * Requires `npx electron-forge start` dependencies installed.
 * Packaging smoke is covered in U7 when `npm run make` is available.
 */
async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.'],
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

test.describe('app launch', () => {
  test('shows one renderer window without Node globals', async () => {
    const { app, page } = await launchApp();
    try {
      await expect(page.getByTestId('office-stage')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Cursor Office')).toBeVisible();
      await expect(page.getByTestId('node-leak')).toHaveCount(0);

      const isolation = await page.evaluate(() => ({
        hasRequire: typeof (window as unknown as { require?: unknown }).require,
        hasProcess: typeof (window as unknown as { process?: unknown }).process,
        hasOffice: typeof window.office,
      }));
      expect(isolation.hasRequire).toBe('undefined');
      expect(isolation.hasProcess).toBe('undefined');
      expect(isolation.hasOffice).toBe('object');
    } finally {
      await app.close();
    }
  });

  test('preload bridge rejects unapproved IPC by not exposing invoke', async () => {
    const { app, page } = await launchApp();
    try {
      const keys = await page.evaluate(() => Object.keys(window.office).sort());
      expect(keys).toEqual(
        [
          'getHealth',
          'getProjection',
          'getSetupPreview',
          'getShellInfo',
          'installHooks',
          'onProjection',
          'uninstall',
        ].sort(),
      );
      const hasRawInvoke = await page.evaluate(() => {
        const api = window.office as unknown as Record<string, unknown>;
        return typeof api.invoke === 'function' || typeof api.send === 'function';
      });
      expect(hasRawInvoke).toBe(false);
    } finally {
      await app.close();
    }
  });
});
