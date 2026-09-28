import type { Collaborator, Consultant, OfficeState } from '../../domain/lifecycle';
import { createEmptyOfficeState } from '../../domain/lifecycle';
import type { Provenance, WorkState } from '../../domain/events';
import { CONSULTANT_LEASE_MS } from '../../domain/events';
import type { OfficeDatabase } from './database';
import { EventRepository } from './event-repository';

interface ConsultantRow {
  key: string;
  conversation_id: string;
  source_id: string;
  work_state: string;
  provenance: string;
  current_generation_id: string | null;
  last_observed_at: number;
  lease_expires_at: number;
  label_suffix: string;
  accent_hue: number;
  seen_generation_ids: string | null;
  stopped_generation_ids: string | null;
}

interface CollaboratorRow {
  key: string;
  parent_conversation_id: string;
  subagent_id: string | null;
  conversation_id: string | null;
  collaborator_type: string;
  work_state: string;
  provenance: string;
  started_at: number;
  fallback_expires_at: number;
}

export class ProjectionRepository {
  constructor(private readonly db: OfficeDatabase) {}

  replaceProjection(state: OfficeState): void {
    this.db.exec('DELETE FROM collaborators');
    this.db.exec('DELETE FROM consultants');

    const insertConsultant = this.db.prepare(
      `INSERT INTO consultants (
        key, conversation_id, source_id, work_state, provenance,
        current_generation_id, last_observed_at, lease_expires_at,
        label_suffix, accent_hue, seen_generation_ids, stopped_generation_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const [key, c] of state.consultants) {
      insertConsultant.run(
        key,
        c.conversationId,
        c.sourceId,
        c.workState,
        c.provenance,
        c.currentGenerationId,
        c.lastObservedAt,
        c.leaseExpiresAt,
        c.labelSuffix,
        c.accentHue,
        JSON.stringify(c.seenGenerationIds),
        JSON.stringify(c.stoppedGenerationIds),
      );
    }

    const insertCollaborator = this.db.prepare(
      `INSERT INTO collaborators (
        key, parent_conversation_id, subagent_id, conversation_id,
        collaborator_type, work_state, provenance, started_at, fallback_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const [key, c] of state.collaborators) {
      insertCollaborator.run(
        key,
        c.parentConversationId,
        c.subagentId,
        c.conversationId,
        c.collaboratorType,
        c.workState,
        c.provenance,
        c.startedAt,
        c.fallbackExpiresAt,
      );
    }
  }

  loadState(nowMs: number = Date.now()): OfficeState {
    const state = createEmptyOfficeState();

    const consultants = this.db
      .prepare('SELECT * FROM consultants')
      .all() as unknown as ConsultantRow[];
    for (const row of consultants) {
      const consultant: Consultant = {
        conversationId: row.conversation_id,
        sourceId: row.source_id,
        workState: row.work_state as WorkState,
        provenance: row.provenance as Provenance,
        currentGenerationId: row.current_generation_id,
        seenGenerationIds: parseIdList(row.seen_generation_ids),
        stoppedGenerationIds: parseIdList(row.stopped_generation_ids),
        lastObservedAt: row.last_observed_at,
        leaseExpiresAt: row.lease_expires_at,
        labelSuffix: row.label_suffix,
        accentHue: row.accent_hue,
      };
      state.consultants.set(row.key, consultant);
    }

    const collaborators = this.db
      .prepare('SELECT * FROM collaborators')
      .all() as unknown as CollaboratorRow[];
    for (const row of collaborators) {
      const collaborator: Collaborator = {
        key: row.key,
        parentConversationId: row.parent_conversation_id,
        subagentId: row.subagent_id,
        conversationId: row.conversation_id,
        collaboratorType: row.collaborator_type,
        workState: row.work_state as Extract<WorkState, 'active' | 'stale'>,
        provenance: row.provenance as Provenance,
        startedAt: row.started_at,
        fallbackExpiresAt: row.fallback_expires_at,
      };
      state.collaborators.set(row.key, collaborator);
    }

    const cutoff = nowMs - CONSULTANT_LEASE_MS;
    const events = new EventRepository(this.db);
    for (const fingerprint of events.listFingerprintsSince(cutoff)) {
      state.seenFingerprints.add(fingerprint);
    }

    return state;
  }

  dumpAllowlistedText(): string {
    const consultants = this.db.prepare('SELECT * FROM consultants').all();
    const collaborators = this.db.prepare('SELECT * FROM collaborators').all();
    return JSON.stringify({ consultants, collaborators });
  }
}

function parseIdList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}
