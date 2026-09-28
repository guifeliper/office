import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';

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

test.describe('office scene', () => {
  test('mounts a full-window canvas with waiting accessibility text when empty', async () => {
    const { app, page } = await launchApp();
    try {
      const canvas = page.getByTestId('office-canvas');
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await expect(canvas).toHaveAttribute(
        'aria-label',
        /Office waiting for Cursor activity|Office disconnected/,
      );
      // Pixi attaches a canvas element inside the host.
      await expect(canvas.locator('canvas')).toBeVisible({ timeout: 15_000 });
    } finally {
      await app.close();
    }
  });
});
