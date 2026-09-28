import type { CanonicalFact } from '../../domain/events';
import type { Clock, OfficeState } from '../../domain/lifecycle';
import { createEmptyOfficeState } from '../../domain/lifecycle';
import {
  applyFact,
  applyStartupInference,
  evaluateLeases,
  projectOffice,
  type OfficeProjection,
} from '../../domain/office-reducer';
import type { OfficeDatabase } from './database';
import { EventRepository } from './event-repository';
import { ProjectionRepository } from './projection-repository';

const KNOWN_KINDS = new Set([
  'work_observed',
  'generation_stopped',
  'collaborator_started',
  'collaborator_stopped',
]);

export class OfficeStore {
  private state: OfficeState;
  private readonly events: EventRepository;
  private readonly projections: ProjectionRepository;

  constructor(
    private readonly db: OfficeDatabase,
    private readonly clock: Clock,
  ) {
    this.events = new EventRepository(db);
    this.projections = new ProjectionRepository(db);
    this.state = createEmptyOfficeState();
  }

  /** Load projection, expire leases, convert unfinished active → stale/inferred. */
  restore(): OfficeProjection {
    this.state = this.projections.loadState();
    this.state = applyStartupInference(this.state, this.clock);
    this.persistProjection();
    return projectOffice(this.state);
  }

  ingest(fact: CanonicalFact): { accepted: boolean; projection: OfficeProjection } {
    if (!KNOWN_KINDS.has(fact.kind)) {
      return { accepted: false, projection: projectOffice(this.state) };
    }

    if (this.events.hasFingerprint(fact.fingerprint)) {
      return { accepted: false, projection: projectOffice(this.state) };
    }

    this.db.exec('BEGIN');
    try {
      const inserted = this.events.insertFact(fact);
      if (!inserted) {
        this.db.exec('ROLLBACK');
        return { accepted: false, projection: projectOffice(this.state) };
      }

      const next = applyFact(this.state, fact, this.clock);
      this.state = evaluateLeases(next, this.clock);
      this.projections.replaceProjection(this.state);
      this.db.exec('COMMIT');
      return { accepted: true, projection: projectOffice(this.state) };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Test helper: force a failing transaction after inserting a fact. */
  ingestWithForcedFailure(fact: CanonicalFact): void {
    this.db.exec('BEGIN');
    this.events.insertFact(fact);
    this.db.exec('ROLLBACK');
  }

  getProjection(): OfficeProjection {
    this.state = evaluateLeases(this.state, this.clock);
    return projectOffice(this.state);
  }

  getState(): OfficeState {
    return this.state;
  }

  privacyDump(): string {
    return `${this.events.dumpAllowlistedText()}\n${this.projections.dumpAllowlistedText()}`;
  }

  private persistProjection(): void {
    this.db.exec('BEGIN');
    try {
      this.projections.replaceProjection(this.state);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
