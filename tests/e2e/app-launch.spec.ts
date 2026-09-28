import { test, expect } from '@playwright/test';
import { cleanupRoot, launchIsolatedApp } from './helpers';

test.describe('app launch', () => {
  test('shows one renderer window without Node globals', async () => {
    const { app, page, root } = await launchIsolatedApp();
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
      cleanupRoot(root);
    }
  });

  test('preload bridge rejects unapproved IPC by not exposing invoke', async () => {
    const { app, page, root } = await launchIsolatedApp();
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
      cleanupRoot(root);
    }
  });
});
