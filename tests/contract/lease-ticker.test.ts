import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COLLABORATOR_FALLBACK_MS, CONSULTANT_LEASE_MS } from '../../src/domain/events';
import { FakeClock } from '../../src/domain/lifecycle';
import { LeaseTicker } from '../../src/main/lease-ticker';
import { closeDatabase, destroyDatabaseFiles, openDatabase } from '../../src/main/storage/database';
import { OfficeStore } from '../../src/main/storage/office-store';

describe('LeaseTicker', () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const p of paths) {
      destroyDatabaseFiles(p);
      fs.rmSync(path.dirname(p), { recursive: true, force: true });
    }
    paths.length = 0;
  });

  it('expires consultants and collaborators while the app is open via injected schedule', () => {
    const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lease-')), 'office.sqlite');
    paths.push(dbPath);
    const clock = new FakeClock(1_700_000_000_000);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    store.ingest({
      kind: 'work_observed',
      sourceId: 'cursor',
      conversationId: 'c1',
      generationId: 'g1',
      fingerprint: 'fp-1',
      receivedAt: clock.now(),
    });
    store.ingest({
      kind: 'collaborator_started',
      sourceId: 'cursor',
      conversationId: 'c1',
      parentConversationId: 'c1',
      subagentId: 's1',
      collaboratorType: 'explore',
      fingerprint: 'fp-s',
      receivedAt: clock.now(),
    });

    let broadcasts = 0;
    const scheduled: Array<() => void> = [];
    const ticker = new LeaseTicker(
      store,
      () => {
        broadcasts += 1;
      },
      30_000,
      (handler) => {
        scheduled.push(handler);
        return { clear: () => undefined };
      },
    );
    ticker.start();
    expect(scheduled).toHaveLength(1);

    clock.advance(COLLABORATOR_FALLBACK_MS);
    scheduled[0]!();
    expect(store.getProjection().collaborators).toHaveLength(0);
    expect(store.getProjection().consultants).toHaveLength(1);
    expect(broadcasts).toBeGreaterThanOrEqual(1);

    clock.advance(CONSULTANT_LEASE_MS);
    const before = broadcasts;
    ticker.tickOnce();
    expect(store.getProjection().consultants).toHaveLength(0);
    expect(broadcasts).toBeGreaterThan(before);

    ticker.stop();
    closeDatabase(db);
  });
});
