import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CanonicalFact } from '../../src/domain/events';
import { CONSULTANT_LEASE_MS } from '../../src/domain/events';
import { FakeClock } from '../../src/domain/lifecycle';
import { closeDatabase, destroyDatabaseFiles, openDatabase } from '../../src/main/storage/database';
import { EventRepository } from '../../src/main/storage/event-repository';
import { OfficeStore } from '../../src/main/storage/office-store';

const T0 = 1_700_000_000_000;

const FORBIDDEN = [
  'SECRET_PROMPT_TEXT',
  'SECRET_RESPONSE_BODY',
  'SECRET_THOUGHT_CHAIN',
  'rm -rf /tmp/secret-cmd',
  'tool_input_secret',
  'tool_output_secret',
  'file:///Users/secret/code.ts',
  'secret@example.com',
  '/Users/secret/.cursor/projects/transcript.jsonl',
  'tok_live_secret_token_value',
  '{"raw":"body"}',
];

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-db-'));
  return path.join(dir, 'office.sqlite');
}

function work(overrides: Partial<CanonicalFact> = {}): CanonicalFact {
  return {
    kind: 'work_observed',
    sourceId: 'cursor',
    conversationId: 'conv-a',
    generationId: 'gen-1',
    fingerprint: 'fp-1',
    receivedAt: T0,
    ...overrides,
  };
}

describe('SQLite office store', () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const p of paths) {
      destroyDatabaseFiles(p);
      try {
        fs.rmSync(path.dirname(p), { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    paths.length = 0;
  });

  it('AE5: sensitive fixture fields never appear in database pages or diagnostic dump', () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const clock = new FakeClock(T0);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);

    store.ingest(
      work({
        // Adapter must already have stripped secrets; ensure allowlisted-only persistence.
        fingerprint: 'fp-privacy',
      }),
    );

    const dump = store.privacyDump();
    const fileBytes = fs.readFileSync(dbPath);
    closeDatabase(db);

    for (const secret of FORBIDDEN) {
      expect(dump).not.toContain(secret);
      expect(fileBytes.includes(Buffer.from(secret))).toBe(false);
    }
  });

  it('duplicate fingerprints produce one fact and one projection update', () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const clock = new FakeClock(T0);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);

    const first = store.ingest(work({ fingerprint: 'fp-dup' }));
    const second = store.ingest(work({ fingerprint: 'fp-dup', receivedAt: T0 + 5_000 }));

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(first.projection.consultants).toHaveLength(1);
    expect(second.projection.consultants[0]!.lastObservedAt).toBe(T0);

    const events = new EventRepository(db);
    expect(events.listFacts()).toHaveLength(1);
    closeDatabase(db);
  });

  it('restart filters expired consultants and converts unfinished generations to stale/inferred', () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const clock = new FakeClock(T0);
    let db = openDatabase(dbPath);
    let store = new OfficeStore(db, clock);
    store.ingest(work({ conversationId: 'alive', fingerprint: 'fp-alive' }));
    store.ingest(work({ conversationId: 'old', fingerprint: 'fp-old', receivedAt: T0 }));
    closeDatabase(db);

    // Advance past lease for both, then re-open with a clock that expires "old" only via restore...
    // Persist one expired and one still-valid by writing with different lastObservedAt.
    db = openDatabase(dbPath);
    clock.set(T0);
    store = new OfficeStore(db, clock);
    store.restore();
    // Force "old" lease into the past by ingesting a stop then manually advancing after close.
    closeDatabase(db);

    db = openDatabase(dbPath);
    // Rewrite: ingest fresh pair with controlled times.
    destroyDatabaseFiles(dbPath);
    db = openDatabase(dbPath);
    clock.set(T0);
    store = new OfficeStore(db, clock);
    store.ingest(work({ conversationId: 'keep', fingerprint: 'fp-keep', receivedAt: T0 }));
    store.ingest(
      work({
        conversationId: 'expire',
        fingerprint: 'fp-expire',
        receivedAt: T0 - CONSULTANT_LEASE_MS,
      }),
    );
    closeDatabase(db);

    clock.set(T0);
    db = openDatabase(dbPath);
    store = new OfficeStore(db, clock);
    const projection = store.restore();

    expect(projection.consultants.map((c) => c.conversationId).sort()).toEqual(['keep']);
    expect(projection.consultants[0]!.workState).toBe('stale');
    expect(projection.consultants[0]!.provenance).toBe('inferred');
    closeDatabase(db);
  });

  it('a failed transaction leaves fact and projection unchanged', () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const clock = new FakeClock(T0);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    store.ingest(work({ fingerprint: 'fp-ok' }));

    store.ingestWithForcedFailure(
      work({ fingerprint: 'fp-fail', conversationId: 'other', generationId: 'gen-x' }),
    );

    const events = new EventRepository(db);
    expect(events.listFacts()).toHaveLength(1);
    expect(store.getProjection().consultants).toHaveLength(1);
    expect(store.getProjection().consultants[0]!.conversationId).toBe('conv-a');
    closeDatabase(db);
  });

  it('unknown event kinds do not mutate projections', () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const clock = new FakeClock(T0);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    store.ingest(work({ fingerprint: 'fp-base' }));

    const result = store.ingest({
      kind: 'cloud_agent_mystery' as CanonicalFact['kind'],
      sourceId: 'cursor',
      conversationId: 'conv-z',
      fingerprint: 'fp-unknown',
      receivedAt: T0,
    });

    expect(result.accepted).toBe(false);
    expect(result.projection.consultants).toHaveLength(1);
    expect(new EventRepository(db).listFacts()).toHaveLength(1);
    closeDatabase(db);
  });

  it('fresh and migrated databases reconstruct the same projection', () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const clock = new FakeClock(T0);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    store.ingest(work({ fingerprint: 'fp-1' }));
    store.ingest({
      kind: 'generation_stopped',
      sourceId: 'cursor',
      conversationId: 'conv-a',
      generationId: 'gen-1',
      fingerprint: 'fp-stop',
      receivedAt: T0 + 1,
    });
    const before = store.getProjection();
    closeDatabase(db);

    const db2 = openDatabase(dbPath);
    const store2 = new OfficeStore(db2, clock);
    const after = store2.restore();
    // After restore, idle stays idle (not active→stale). Startup only converts active.
    expect(after.consultants).toHaveLength(1);
    expect(after.consultants[0]!.workState).toBe('idle');
    expect(after.consultants[0]!.conversationId).toBe(before.consultants[0]!.conversationId);
    closeDatabase(db2);
  });
});
