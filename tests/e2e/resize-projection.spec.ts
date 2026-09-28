import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { cleanupRoot, launchIsolatedApp } from './helpers';

test.describe('resize projection', () => {
  test('occupants survive window resize after async office init', async () => {
    const { app, page, root, userData } = await launchIsolatedApp();
    try {
      await page.getByTestId('confirm-install').click();
      await expect(page.getByTestId('connect-cursor')).toHaveCount(0);

      const token = fs.readFileSync(path.join(userData, 'ingest.token'), 'utf8').trim();
      const port = fs.readFileSync(path.join(userData, 'ingest.port'), 'utf8').trim();
      const res = await fetch(`http://127.0.0.1:${port}/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Cursor-Office-Hook': 'preToolUse',
        },
        body: JSON.stringify({
          hook_event_name: 'preToolUse',
          conversation_id: 'resize-conv',
          generation_id: 'gen-r',
          tool_name: 'Read',
          tool_use_id: 'tu-resize',
          cursor_version: '1.7.2',
        }),
      });
      expect(res.status).toBe(204);

      await expect
        .poll(async () => {
          const projection = (await page.evaluate(async () => window.office.getProjection())) as {
            consultants: unknown[];
          };
          return projection.consultants.length;
        })
        .toBe(1);

      await expect(page.getByTestId('office-canvas')).toHaveAttribute(
        'aria-label',
        /Office with 1 consultants/,
      );

      // Resize the BrowserWindow — handlers must read latestRef, not the empty mount closure.
      await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (!win) throw new Error('no window');
        win.setSize(1100, 720);
      });

      await expect(page.getByTestId('office-canvas')).toHaveAttribute(
        'aria-label',
        /Office with 1 consultants/,
        { timeout: 5_000 },
      );
      const after = (await page.evaluate(async () => window.office.getProjection())) as {
        consultants: Array<{ conversationId: string }>;
      };
      expect(after.consultants.map((c) => c.conversationId)).toEqual(['resize-conv']);
    } finally {
      await app.close();
      cleanupRoot(root);
    }
  });
});
