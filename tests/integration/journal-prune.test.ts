import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONSULTANT_LEASE_MS } from '../../src/domain/events';
import { FakeClock } from '../../src/domain/lifecycle';
import { closeDatabase, destroyDatabaseFiles, openDatabase } from '../../src/main/storage/database';
import { EventRepository } from '../../src/main/storage/event-repository';
import { OfficeStore } from '../../src/main/storage/office-store';

describe('bounded fact journal', () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const p of paths) {
      destroyDatabaseFiles(p);
      fs.rmSync(path.dirname(p), { recursive: true, force: true });
    }
    paths.length = 0;
  });

  it('prunes facts older than the consultant lease window on ingest', () => {
    const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prune-')), 'office.sqlite');
    paths.push(dbPath);
    const clock = new FakeClock(2_000_000_000_000);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);

    store.ingest({
      kind: 'work_observed',
      sourceId: 'cursor',
      conversationId: 'old',
      generationId: 'g-old',
      fingerprint: 'fp-old',
      receivedAt: clock.now() - CONSULTANT_LEASE_MS - 1,
    });
    // Force clock forward and ingest a fresh fact — prune runs inside the transaction.
    clock.advance(1);
    store.ingest({
      kind: 'work_observed',
      sourceId: 'cursor',
      conversationId: 'new',
      generationId: 'g-new',
      fingerprint: 'fp-new',
      receivedAt: clock.now(),
    });

    const events = new EventRepository(db);
    const facts = events.listFacts();
    expect(facts.every((f) => f.fingerprint !== 'fp-old' || f.receivedAt >= clock.now() - CONSULTANT_LEASE_MS)).toBe(
      true,
    );
    // Old fact is outside the window relative to "now" after prune.
    expect(facts.find((f) => f.fingerprint === 'fp-old')).toBeUndefined();
    expect(facts.find((f) => f.fingerprint === 'fp-new')).toBeDefined();
    closeDatabase(db);
  });
});
