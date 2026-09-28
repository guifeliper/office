import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/domain/lifecycle';
import { stageWrapper } from '../../src/main/cursor/hook-installer';
import { ensureInstallToken, writePortFile } from '../../src/main/cursor/token';
import { responseForHook } from '../../src/main/cursor/hook-config';
import { startIngestionServer } from '../../src/main/ingestion/server';
import { closeDatabase, destroyDatabaseFiles, openDatabase } from '../../src/main/storage/database';
import { OfficeStore } from '../../src/main/storage/office-store';
import { SENSITIVE_FIXTURE } from '../fixtures/cursor-hooks';

const SOURCE_WRAPPER = path.resolve(__dirname, '../../resources/cursor-hook.sh');

describe('staged wrapper as Cursor would invoke it', () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it('discovers token/port beside the script with no injected Electron env', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-staged-'));
    roots.push(root);
    const userData = path.join(root, 'userdata');
    const dbPath = path.join(root, 'office.sqlite');
    fs.mkdirSync(userData, { recursive: true, mode: 0o700 });

    const clock = new FakeClock(Date.now());
    const db = openDatabase(dbPath);
    const store = new OfficeStore(db, clock);
    const token = ensureInstallToken(userData);
    const server = await startIngestionServer({ token, store, clock });
    writePortFile(userData, server.port);

    const staged = stageWrapper(SOURCE_WRAPPER, userData);
    expect(staged).toBe(path.join(userData, 'cursor-hook.sh'));
    expect(fs.existsSync(path.join(userData, 'ingest.token'))).toBe(true);
    expect(fs.existsSync(path.join(userData, 'ingest.port'))).toBe(true);

    // Exact Cursor-like invocation: clean env, only PATH. No CURSOR_OFFICE_* vars.
    const result = spawnSync(
      '/usr/bin/env',
      ['-i', 'PATH=/usr/bin:/bin:/usr/sbin:/sbin', staged, 'preToolUse'],
      {
        input: JSON.stringify(SENSITIVE_FIXTURE),
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(responseForHook('preToolUse'));
    expect(result.stderr ?? '').not.toMatch(/SECRET_|tok_live|Bearer/);

    await new Promise((r) => setTimeout(r, 80));
    expect(store.getProjection().consultants).toHaveLength(1);

    await server.close();
    closeDatabase(db);
    destroyDatabaseFiles(dbPath);
  });

  it('never puts the Bearer token in curl argv and never uses here-strings for stdin', () => {
    const source = fs.readFileSync(SOURCE_WRAPPER, 'utf8');
    expect(source).toContain("-H @<(printf 'Authorization: Bearer %s\\n' \"$TOKEN\")");
    expect(source).not.toMatch(/-H "Authorization: Bearer \$\{TOKEN\}"/);
    expect(source).toContain("printf '%s' \"$STDIN_DATA\" | curl");
    expect(source).not.toContain('<<<');
    expect(source).toContain('DIR="$(cd "$(dirname "$0")" && pwd)"');
    expect(source).toContain('TOKEN_FILE="${CURSOR_OFFICE_TOKEN_FILE:-$DIR/ingest.token}"');
  });

  it('pipes stdin as a Fifo, not a Regular File (bash 3.2 here-string regression)', () => {
    const probe = spawnSync(
      '/bin/bash',
      [
        '-c',
        `printf '%s' 'payload' | /bin/bash -c 'stat -L -f %HT /dev/stdin'; /bin/bash -c 'stat -L -f %HT /dev/stdin <<< payload'`,
      ],
      { encoding: 'utf8' },
    );
    const lines = probe.stdout.trim().split('\n');
    expect(lines[0]).toBe('Fifo File');
    expect(lines[1]).toBe('Regular File');
  });
});
