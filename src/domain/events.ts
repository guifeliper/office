/**
 * Source-neutral canonical facts.
 * Office domain must never import Cursor hook payload types.
 */

export type Provenance = 'observed' | 'inferred' | 'ambient';

export type WorkState = 'active' | 'idle' | 'stale';

export type CanonicalFactKind =
  | 'work_observed'
  | 'generation_stopped'
  | 'collaborator_started'
  | 'collaborator_stopped';

/** Allowlisted metadata retained after sanitization. */
export const RETAINED_FACT_FIELDS = [
  'kind',
  'sourceId',
  'conversationId',
  'generationId',
  'subagentId',
  'parentConversationId',
  'collaboratorType',
  'fingerprint',
  'receivedAt',
  'cursorVersion',
] as const;

export type RetainedFactField = (typeof RETAINED_FACT_FIELDS)[number];

export interface CanonicalFact {
  kind: CanonicalFactKind;
  /** Stable source identifier, e.g. "cursor". */
  sourceId: string;
  conversationId: string;
  generationId?: string;
  subagentId?: string;
  parentConversationId?: string;
  collaboratorType?: string;
  /** Deduplication key assigned by the adapter/writer. */
  fingerprint: string;
  /** Collector receipt time (ms since epoch). Authoritative. */
  receivedAt: number;
  cursorVersion?: string;
}

export const CONSULTANT_LEASE_MS = 24 * 60 * 60 * 1000;
export const COLLABORATOR_FALLBACK_MS = 30 * 60 * 1000;
