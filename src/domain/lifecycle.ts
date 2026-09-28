import type { Provenance, WorkState } from './events';
import { COLLABORATOR_FALLBACK_MS, CONSULTANT_LEASE_MS } from './events';

export interface Clock {
  now(): number;
}

export class FakeClock implements Clock {
  constructor(private millis: number) {}

  now(): number {
    return this.millis;
  }

  advance(ms: number): void {
    this.millis += ms;
  }

  set(ms: number): void {
    this.millis = ms;
  }
}

export interface Consultant {
  conversationId: string;
  sourceId: string;
  workState: WorkState;
  provenance: Provenance;
  currentGenerationId: string | null;
  lastObservedAt: number;
  leaseExpiresAt: number;
  /** Stable 4-character label suffix for display. */
  labelSuffix: string;
  /** Stable accent hue in degrees [0, 360). */
  accentHue: number;
}

export interface Collaborator {
  key: string;
  parentConversationId: string;
  subagentId: string | null;
  conversationId: string | null;
  collaboratorType: string;
  workState: Extract<WorkState, 'active' | 'stale'>;
  provenance: Provenance;
  startedAt: number;
  fallbackExpiresAt: number;
}

export interface OfficeState {
  consultants: Map<string, Consultant>;
  collaborators: Map<string, Collaborator>;
  seenFingerprints: Set<string>;
}

export function createEmptyOfficeState(): OfficeState {
  return {
    consultants: new Map(),
    collaborators: new Map(),
    seenFingerprints: new Set(),
  };
}

export function consultantKey(sourceId: string, conversationId: string): string {
  return `${sourceId}:${conversationId}`;
}

/** Stable, non-content label material derived from source + conversation identity. */
export function deriveLabelSuffix(sourceId: string, conversationId: string): string {
  const hash = fnv1a(`${sourceId}:${conversationId}`);
  return hash.toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

export function deriveAccentHue(sourceId: string, conversationId: string): number {
  return fnv1a(`${sourceId}:${conversationId}:accent`) % 360;
}

export function isAmbientEligible(consultant: Consultant): boolean {
  return consultant.workState === 'idle' && consultant.provenance === 'observed';
}

export function leaseFrom(lastObservedAt: number): number {
  return lastObservedAt + CONSULTANT_LEASE_MS;
}

export function collaboratorFallbackFrom(startedAt: number): number {
  return startedAt + COLLABORATOR_FALLBACK_MS;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
