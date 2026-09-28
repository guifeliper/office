import type { CanonicalFact, CanonicalFactKind } from '../../domain/events';
import { CONSULTANT_LEASE_MS } from '../../domain/events';
import type { OfficeDatabase } from './database';

interface FactRow {
  fingerprint: string;
  kind: string;
  source_id: string;
  conversation_id: string;
  generation_id: string | null;
  subagent_id: string | null;
  parent_conversation_id: string | null;
  collaborator_type: string | null;
  received_at: number;
  cursor_version: string | null;
}

export class EventRepository {
  constructor(private readonly db: OfficeDatabase) {}

  hasFingerprint(fingerprint: string): boolean {
    const row = this.db
      .prepare('SELECT 1 AS ok FROM facts WHERE fingerprint = ? LIMIT 1')
      .get(fingerprint) as unknown as { ok: number } | undefined;
    return row !== undefined;
  }

  insertFact(fact: CanonicalFact): boolean {
    if (this.hasFingerprint(fact.fingerprint)) {
      return false;
    }
    this.db
      .prepare(
        `INSERT INTO facts (
          fingerprint, kind, source_id, conversation_id, generation_id,
          subagent_id, parent_conversation_id, collaborator_type,
          received_at, cursor_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fact.fingerprint,
        fact.kind,
        fact.sourceId,
        fact.conversationId,
        fact.generationId ?? null,
        fact.subagentId ?? null,
        fact.parentConversationId ?? null,
        fact.collaboratorType ?? null,
        fact.receivedAt,
        fact.cursorVersion ?? null,
      );
    return true;
  }

  /** Drop facts outside the consultant lease window (bounded journal). */
  pruneOlderThan(cutoffMs: number): number {
    const result = this.db.prepare('DELETE FROM facts WHERE received_at < ?').run(cutoffMs);
    return Number(result.changes ?? 0);
  }

  pruneBeyondLease(nowMs: number): number {
    return this.pruneOlderThan(nowMs - CONSULTANT_LEASE_MS);
  }

  listFingerprintsSince(cutoffMs: number): string[] {
    const rows = this.db
      .prepare('SELECT fingerprint FROM facts WHERE received_at >= ?')
      .all(cutoffMs) as unknown as Array<{ fingerprint: string }>;
    return rows.map((r) => r.fingerprint);
  }

  listFacts(): CanonicalFact[] {
    const rows = this.db
      .prepare('SELECT * FROM facts ORDER BY id ASC')
      .all() as unknown as FactRow[];
    return rows.map(rowToFact);
  }

  /** Diagnostic dump used by privacy tests — must never include forbidden content. */
  dumpAllowlistedText(): string {
    const rows = this.listFacts();
    return JSON.stringify(rows);
  }
}

function rowToFact(row: FactRow): CanonicalFact {
  const fact: CanonicalFact = {
    kind: row.kind as CanonicalFactKind,
    sourceId: row.source_id,
    conversationId: row.conversation_id,
    fingerprint: row.fingerprint,
    receivedAt: row.received_at,
  };
  if (row.generation_id !== null) fact.generationId = row.generation_id;
  if (row.subagent_id !== null) fact.subagentId = row.subagent_id;
  if (row.parent_conversation_id !== null) {
    fact.parentConversationId = row.parent_conversation_id;
  }
  if (row.collaborator_type !== null) fact.collaboratorType = row.collaborator_type;
  if (row.cursor_version !== null) fact.cursorVersion = row.cursor_version;
  return fact;
}
