import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/domain/lifecycle';
import { ensureInstallToken, writePortFile } from '../../src/main/cursor/token';
import { startIngestionServer } from '../../src/main/ingestion/server';
import { closeDatabase, destroyDatabaseFiles, openDatabase } from '../../src/main/storage/database';
import { OfficeStore } from '../../src/main/storage/office-store';

describe('burst ingestion', () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it('handles duplicate and out-of-order bursts without growing duplicate consultants', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-burst-'));
    roots.push(root);
    const dbPath = path.join(root, 'office.sqlite');
    const userData = path.join(root, 'userdata');
    const clock = new FakeClock(Date.now());
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    const token = ensureInstallToken(userData);
    const server = await startIngestionServer({ token, store, clock });
    writePortFile(userData, server.port);

    const payloads = Array.from({ length: 40 }, (_, i) => ({
      hook_event_name: i % 5 === 0 ? 'stop' : 'preToolUse',
      conversation_id: 'burst-conv',
      generation_id: i < 20 ? 'gen-1' : 'gen-2',
      tool_call_id: `tc-${i % 7}`,
      tool_name: 'Shell',
      cursor_version: '1.7.2',
    }));

    // Out-of-order: send later generation first, then earlier stop duplicates.
    const order = [...payloads].reverse();
    await Promise.all(
      order.map((body) =>
        fetch(`http://127.0.0.1:${server.port}/ingest`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Cursor-Office-Hook': body.hook_event_name,
          },
          body: JSON.stringify(body),
        }),
      ),
    );

    const projection = store.getProjection();
    expect(projection.consultants).toHaveLength(1);
    expect(projection.consultants[0]!.conversationId).toBe('burst-conv');

    await server.close();
    closeDatabase(db);
    destroyDatabaseFiles(dbPath);
  });
});
