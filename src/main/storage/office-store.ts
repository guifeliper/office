import type { CanonicalFact } from '../../domain/events';
import { CONSULTANT_LEASE_MS } from '../../domain/events';
import type { Clock, OfficeState } from '../../domain/lifecycle';
import { createEmptyOfficeState } from '../../domain/lifecycle';
import {
  applyFact,
  applyStartupInference,
  evaluateLeases,
  projectOffice,
  projectionsEqual,
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
    this.state = this.projections.loadState(this.clock.now());
    this.state = applyStartupInference(this.state, this.clock);
    this.events.pruneBeyondLease(this.clock.now());
    this.syncFingerprintSet();
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

    const previous = this.state;
    this.db.exec('BEGIN');
    try {
      const inserted = this.events.insertFact(fact);
      if (!inserted) {
        this.db.exec('ROLLBACK');
        return { accepted: false, projection: projectOffice(this.state) };
      }

      // Compute next without mutating in-memory state until COMMIT succeeds.
      const next = evaluateLeases(applyFact(previous, fact, this.clock), this.clock);
      this.events.pruneBeyondLease(this.clock.now());
      this.projections.replaceProjection(next);
      this.db.exec('COMMIT');
      this.state = next;
      this.syncFingerprintSet();
      return { accepted: true, projection: projectOffice(this.state) };
    } catch (error) {
      this.db.exec('ROLLBACK');
      // previous state retained — journal and projection stay aligned
      throw error;
    }
  }

  /**
   * Evaluate leases/fallbacks while the app is open. Persists only when the
   * projection changes.
   */
  tickLeases(): { changed: boolean; projection: OfficeProjection } {
    const before = projectOffice(this.state);
    const next = evaluateLeases(this.state, this.clock);
    const after = projectOffice(next);
    if (projectionsEqual(before, after)) {
      return { changed: false, projection: after };
    }
    this.state = next;
    this.persistProjection();
    return { changed: true, projection: after };
  }

  getProjection(): OfficeProjection {
    const { projection } = this.tickLeases();
    return projection;
  }

  getState(): OfficeState {
    return this.state;
  }

  privacyDump(): string {
    return `${this.events.dumpAllowlistedText()}\n${this.projections.dumpAllowlistedText()}`;
  }

  /** Test seam: force replaceProjection to throw inside a real ingest transaction. */
  ingestWithProjectionFailure(fact: CanonicalFact): void {
    const original = this.projections.replaceProjection.bind(this.projections);
    this.projections.replaceProjection = () => {
      throw new Error('forced projection failure');
    };
    try {
      this.ingest(fact);
    } finally {
      this.projections.replaceProjection = original;
    }
  }

  private syncFingerprintSet(): void {
    const fingerprints = this.events.listFingerprintsSince(
      this.clock.now() - CONSULTANT_LEASE_MS,
    );
    this.state = {
      ...this.state,
      seenFingerprints: new Set(fingerprints),
    };
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
