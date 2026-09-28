import { test, expect } from '@playwright/test';
import { cleanupRoot, launchIsolatedApp } from './helpers';

test.describe('office scene', () => {
  test('mounts a full-window canvas with waiting accessibility text when empty', async () => {
    const { app, page, root } = await launchIsolatedApp();
    try {
      const canvas = page.getByTestId('office-canvas');
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await expect(canvas).toHaveAttribute(
        'aria-label',
        /Office waiting for Cursor activity|Office disconnected/,
      );
      await expect(canvas.locator('canvas')).toBeVisible({ timeout: 15_000 });
    } finally {
      await app.close();
      cleanupRoot(root);
    }
  });
});
