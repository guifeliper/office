import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { cleanupRoot, launchIsolatedApp } from './helpers';
import { SUBSCRIBED_HOOKS } from '../../src/main/cursor/hook-config';

test.describe('onboarding', () => {
  test('preview lists hooks/fields/command and install waits for confirmation', async () => {
    const { app, page, root, hooksJsonPath } = await launchIsolatedApp();
    try {
      await expect(page.getByTestId('connect-cursor')).toBeVisible({ timeout: 30_000 });

      for (const hook of SUBSCRIBED_HOOKS) {
        await expect(page.getByTestId('preview-hooks')).toContainText(hook);
      }
      await expect(page.getByTestId('preview-fields')).toContainText('conversation_id');
      await expect(page.getByTestId('preview-command')).toContainText('cursor-hook.sh');
      await expect(page.getByTestId('preview-change')).toContainText('beforeSubmitPrompt');

      const before = fs.readFileSync(hooksJsonPath, 'utf8');
      expect(before).toContain('unrelated-session-end');
      expect(before).not.toContain('cursor-office-observer');

      await page.getByTestId('confirm-install').click();
      await expect(page.getByTestId('connect-cursor')).toHaveCount(0);
      await expect(page.getByTestId('observation-status')).toContainText(/waiting|connected/i);

      const after = fs.readFileSync(hooksJsonPath, 'utf8');
      expect(after).toContain('unrelated-session-end');
      expect(after).toContain('cursor-office-observer');
    } finally {
      await app.close();
      cleanupRoot(root);
    }
  });

  test('uninstall removes Office entries and preserves unrelated hooks', async () => {
    const { app, page, root, hooksJsonPath, userData } = await launchIsolatedApp();
    try {
      await page.getByTestId('confirm-install').click();
      await expect(page.getByTestId('connect-cursor')).toHaveCount(0);

      await page.getByTestId('open-settings').click();
      await expect(page.getByTestId('integration-settings')).toBeVisible();
      await page.getByTestId('confirm-uninstall').click();
      await expect(page.getByTestId('connect-cursor')).toBeVisible();

      const hooks = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8')) as {
        hooks: Record<string, Array<{ command: string }>>;
      };
      expect(hooks.hooks.sessionEnd?.[0]?.command).toBe('echo unrelated-session-end');
      expect(JSON.stringify(hooks)).not.toContain('cursor-office-observer');
      expect(fs.existsSync(`${userData}/ingest.token`)).toBe(false);
      expect(fs.existsSync(`${userData}/hooks.json.backup`)).toBe(false);
    } finally {
      await app.close();
      cleanupRoot(root);
    }
  });
});
