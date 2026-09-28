import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = 2;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      source_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      generation_id TEXT,
      subagent_id TEXT,
      parent_conversation_id TEXT,
      collaborator_type TEXT,
      received_at INTEGER NOT NULL,
      cursor_version TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_facts_conversation ON facts(source_id, conversation_id);

    CREATE TABLE IF NOT EXISTS consultants (
      key TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      work_state TEXT NOT NULL,
      provenance TEXT NOT NULL,
      current_generation_id TEXT,
      last_observed_at INTEGER NOT NULL,
      lease_expires_at INTEGER NOT NULL,
      label_suffix TEXT NOT NULL,
      accent_hue INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collaborators (
      key TEXT PRIMARY KEY NOT NULL,
      parent_conversation_id TEXT NOT NULL,
      subagent_id TEXT,
      conversation_id TEXT,
      collaborator_type TEXT NOT NULL,
      work_state TEXT NOT NULL,
      provenance TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      fallback_expires_at INTEGER NOT NULL
    );
  `,
  2: `
    ALTER TABLE consultants ADD COLUMN seen_generation_ids TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE consultants ADD COLUMN stopped_generation_ids TEXT NOT NULL DEFAULT '[]';
    CREATE INDEX IF NOT EXISTS idx_facts_received_at ON facts(received_at);
  `,
};

export type OfficeDatabase = DatabaseSync;

export function openDatabase(dbPath: string): OfficeDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

export function migrate(db: OfficeDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const row = db
    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
      .get() as unknown as { version: number } | undefined;
  let current = row?.version ?? 0;

  while (current < SCHEMA_VERSION) {
    const next = current + 1;
    const sql = MIGRATIONS[next];
    if (!sql) {
      throw new Error(`Missing migration for schema version ${next}`);
    }
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(
        next,
        Date.now(),
      );
      db.exec('COMMIT');
      current = next;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function closeDatabase(db: OfficeDatabase): void {
  db.close();
}

/** Delete the SQLite file and WAL/SHM sidecars. */
export function destroyDatabaseFiles(dbPath: string): void {
  for (const candidate of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]) {
    try {
      fs.rmSync(candidate, { force: true });
    } catch {
      // ignore missing sidecars
    }
  }
}
