import { expect, test, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { CONSULTANT_LEASE_MS } from '../../src/domain/events';
import { FakeClock } from '../../src/domain/lifecycle';
import { openDatabase, closeDatabase, destroyDatabaseFiles } from '../../src/main/storage/database';
import { OfficeStore } from '../../src/main/storage/office-store';
import { cleanupRoot, launchIsolatedApp } from './helpers';

test.describe('restart and expiry', () => {
  test('restores unfinished active consultant as stale/inferred and drops expired ones', async () => {
    const { app, page, root, userData, hooksJsonPath } = await launchIsolatedApp();
    try {
      await page.getByTestId('confirm-install').click();
      await expect(page.getByTestId('connect-cursor')).toHaveCount(0);
      await app.close();

      const now = Date.now();
      const dbPath = path.join(userData, 'office.sqlite');
      const clock = new FakeClock(now);
      const db = openDatabase(dbPath);
      const store = new OfficeStore(db, clock);
      store.restore();
      store.ingest({
        kind: 'work_observed',
        sourceId: 'cursor',
        conversationId: 'keep-stale',
        generationId: 'gen-live',
        fingerprint: `fp-live-${now}`,
        receivedAt: now,
      });
      store.ingest({
        kind: 'work_observed',
        sourceId: 'cursor',
        conversationId: 'expire-me',
        generationId: 'gen-old',
        fingerprint: `fp-old-${now}`,
        receivedAt: now - CONSULTANT_LEASE_MS,
      });
      closeDatabase(db);

      const wrapperPath = path.resolve(__dirname, '../../resources/cursor-hook.sh');
      const app2 = await electron.launch({
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
      const page2 = await app2.firstWindow();
      await page2.waitForLoadState('domcontentloaded');
      await expect(page2.getByTestId('observation-status')).toBeVisible({ timeout: 30_000 });

      // App startup already restored; read projection through the bridge.
      const projection = (await page2.evaluate(async () => window.office.getProjection())) as {
        consultants: Array<{ conversationId: string; workState: string; provenance: string }>;
      };
      expect(projection.consultants.map((c) => c.conversationId)).toEqual(['keep-stale']);
      expect(projection.consultants[0]!.workState).toBe('stale');
      expect(projection.consultants[0]!.provenance).toBe('inferred');

      await expect(page2.getByTestId('observation-status')).toContainText(/stale/i);
      await app2.close();
    } finally {
      destroyDatabaseFiles(path.join(userData, 'office.sqlite'));
      cleanupRoot(root);
    }
  });
});
