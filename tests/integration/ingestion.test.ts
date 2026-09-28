import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/domain/lifecycle';
import { responseForHook } from '../../src/main/cursor/hook-config';
import { ensureInstallToken, writePortFile } from '../../src/main/cursor/token';
import { startIngestionServer, type IngestionServer } from '../../src/main/ingestion/server';
import { closeDatabase, destroyDatabaseFiles, openDatabase } from '../../src/main/storage/database';
import { OfficeStore } from '../../src/main/storage/office-store';
import { FORBIDDEN_STRINGS, SENSITIVE_FIXTURE, STOP_FIXTURE } from '../fixtures/cursor-hooks';

const WRAPPER = path.resolve(__dirname, '../../resources/cursor-hook.sh');

describe('ingestion + hook wrapper', () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    while (cleanups.length) {
      await cleanups.pop()?.();
    }
  });

  it('AE6: app unavailable / timeout / malformed stdin print event-specific response and exit 0', () => {
    const cases: Array<{ hook: string; body: string }> = [
      { hook: 'preToolUse', body: '{' },
      { hook: 'beforeSubmitPrompt', body: '{"conversation_id":"x"}' },
      { hook: 'stop', body: '' },
      { hook: 'afterAgentResponse', body: 'not-json' },
    ];

    for (const c of cases) {
      const result = spawnSync('bash', [WRAPPER, c.hook], {
        input: c.body,
        env: {
          ...process.env,
          CURSOR_OFFICE_TOKEN_FILE: '/tmp/office-missing-token',
          CURSOR_OFFICE_PORT_FILE: '/tmp/office-missing-port',
          CURSOR_OFFICE_TIMEOUT_SECS: '1',
        },
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(responseForHook(c.hook));
      expect(result.stderr ?? '').not.toContain('SECRET_');
    }
  });

  it('rejects missing/invalid tokens before parsing and does not create office state', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-ingest-'));
    const dbPath = path.join(root, 'office.sqlite');
    const userData = path.join(root, 'userdata');
    const clock = new FakeClock(1_700_000_000_000);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    const token = ensureInstallToken(userData);
    const server = await startIngestionServer({ token, store, clock });
    writePortFile(userData, server.port);

    cleanups.push(async () => {
      await server.close();
      closeDatabase(db);
      destroyDatabaseFiles(dbPath);
      fs.rmSync(root, { recursive: true, force: true });
    });

    const bad = await fetch(`http://127.0.0.1:${server.port}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-token-value-xxxxxxxxxxxxxxxxxxxx',
        'Content-Type': 'application/json',
        'X-Cursor-Office-Hook': 'preToolUse',
      },
      body: JSON.stringify(SENSITIVE_FIXTURE),
    });
    expect(bad.status).toBe(401);
    expect(store.getProjection().consultants).toHaveLength(0);
  });

  it('accepts authenticated allowlisted events and never persists forbidden strings', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-ingest-'));
    const dbPath = path.join(root, 'office.sqlite');
    const userData = path.join(root, 'userdata');
    const clock = new FakeClock(1_700_000_000_000);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    const token = ensureInstallToken(userData);
    let latest = store.getProjection();
    const server: IngestionServer = await startIngestionServer({
      token,
      store,
      clock,
      onProjection: (p) => {
        latest = p;
      },
    });
    const portFile = writePortFile(userData, server.port);
    const tokenFile = path.join(userData, 'ingest.token');

    cleanups.push(async () => {
      await server.close();
      closeDatabase(db);
      destroyDatabaseFiles(dbPath);
      fs.rmSync(root, { recursive: true, force: true });
    });

    const mode = fs.statSync(tokenFile).mode & 0o777;
    expect(mode).toBe(0o600);

    const result = spawnSync('bash', [WRAPPER, 'preToolUse'], {
      input: JSON.stringify(SENSITIVE_FIXTURE),
      env: {
        ...process.env,
        CURSOR_OFFICE_TOKEN_FILE: tokenFile,
        CURSOR_OFFICE_PORT_FILE: portFile,
        CURSOR_OFFICE_TIMEOUT_SECS: '2',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(responseForHook('preToolUse'));
    expect(result.stderr ?? '').not.toMatch(/SECRET_|tok_live/);

    // Give the async server a tick.
    await new Promise((r) => setTimeout(r, 50));
    expect(latest.consultants).toHaveLength(1);
    expect(latest.consultants[0]!.workState).toBe('active');

    const dump = store.privacyDump();
    const dbBytes = fs.readFileSync(dbPath);
    for (const secret of FORBIDDEN_STRINGS) {
      expect(dump).not.toContain(secret);
      expect(dbBytes.includes(Buffer.from(secret))).toBe(false);
    }

    const stop = await fetch(`http://127.0.0.1:${server.port}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Cursor-Office-Hook': 'stop',
      },
      body: JSON.stringify(STOP_FIXTURE),
    });
    expect(stop.status).toBe(204);
    expect(store.getProjection().consultants[0]!.workState).toBe('idle');
  });

  it('rejects oversized payloads before persistence', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-ingest-'));
    const dbPath = path.join(root, 'office.sqlite');
    const userData = path.join(root, 'userdata');
    const clock = new FakeClock(1_700_000_000_000);
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    const token = ensureInstallToken(userData);
    const server = await startIngestionServer({ token, store, clock });

    cleanups.push(async () => {
      await server.close();
      closeDatabase(db);
      destroyDatabaseFiles(dbPath);
      fs.rmSync(root, { recursive: true, force: true });
    });

    const huge = JSON.stringify({
      hook_event_name: 'preToolUse',
      conversation_id: 'c',
      generation_id: 'g',
      padding: 'x'.repeat(70_000),
    });
    const res = await fetch(`http://127.0.0.1:${server.port}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Cursor-Office-Hook': 'preToolUse',
      },
      body: huge,
    });
    expect(res.status).toBe(413);
    expect(store.getProjection().consultants).toHaveLength(0);
  });
});
