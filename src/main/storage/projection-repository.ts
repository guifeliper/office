import type { Collaborator, Consultant, OfficeState } from '../../domain/lifecycle';
import { createEmptyOfficeState } from '../../domain/lifecycle';
import type { OfficeDatabase } from './database';
import type { Provenance, WorkState } from '../../domain/events';

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
        label_suffix, accent_hue
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  loadState(): OfficeState {
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

    const fingerprints = this.db
      .prepare('SELECT fingerprint FROM facts')
      .all() as unknown as Array<{ fingerprint: string }>;
    for (const row of fingerprints) {
      state.seenFingerprints.add(row.fingerprint);
    }

    return state;
  }

  dumpAllowlistedText(): string {
    const consultants = this.db.prepare('SELECT * FROM consultants').all();
    const collaborators = this.db.prepare('SELECT * FROM collaborators').all();
    return JSON.stringify({ consultants, collaborators });
  }
}
