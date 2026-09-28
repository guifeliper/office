import type { CanonicalFact } from './events';
import {
  type Clock,
  type Collaborator,
  type Consultant,
  type OfficeState,
  collaboratorFallbackFrom,
  consultantKey,
  deriveAccentHue,
  deriveLabelSuffix,
  leaseFrom,
  pushBoundedId,
} from './lifecycle';

export interface OfficeProjection {
  consultants: Consultant[];
  collaborators: Collaborator[];
}

export function projectOffice(state: OfficeState): OfficeProjection {
  return {
    consultants: [...state.consultants.values()].sort((a, b) =>
      a.conversationId.localeCompare(b.conversationId),
    ),
    collaborators: [...state.collaborators.values()].sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
  };
}

export function applyFact(state: OfficeState, fact: CanonicalFact, _clock: Clock): OfficeState {
  if (state.seenFingerprints.has(fact.fingerprint)) {
    return state;
  }

  const next: OfficeState = {
    consultants: new Map(state.consultants),
    collaborators: new Map(state.collaborators),
    seenFingerprints: new Set(state.seenFingerprints),
  };
  next.seenFingerprints.add(fact.fingerprint);

  switch (fact.kind) {
    case 'work_observed':
      return applyWorkObserved(next, fact);
    case 'generation_stopped':
      return applyGenerationStopped(next, fact);
    case 'collaborator_started':
      return applyCollaboratorStarted(next, fact);
    case 'collaborator_stopped':
      return applyCollaboratorStopped(next, fact);
    default: {
      const _exhaustive: never = fact.kind;
      return _exhaustive;
    }
  }
}

export function evaluateLeases(state: OfficeState, clock: Clock): OfficeState {
  const now = clock.now();
  const consultants = new Map(state.consultants);
  const collaborators = new Map(state.collaborators);

  for (const [key, consultant] of consultants) {
    if (consultant.leaseExpiresAt <= now) {
      consultants.delete(key);
      for (const [ck, collab] of collaborators) {
        if (collab.parentConversationId === consultant.conversationId) {
          collaborators.delete(ck);
        }
      }
    }
  }

  for (const [key, collab] of collaborators) {
    if (collab.fallbackExpiresAt <= now) {
      collaborators.delete(key);
    }
  }

  return {
    consultants,
    collaborators,
    seenFingerprints: state.seenFingerprints,
  };
}

/**
 * On app restart: retained observed-active generations become stale/inferred.
 * Does not move lastObservedAt or leaseExpiresAt.
 */
export function applyStartupInference(state: OfficeState, clock: Clock): OfficeState {
  const leased = evaluateLeases(state, clock);
  const consultants = new Map(leased.consultants);
  const collaborators = new Map(leased.collaborators);

  for (const [key, consultant] of consultants) {
    if (consultant.workState === 'active' && consultant.provenance === 'observed') {
      consultants.set(key, {
        ...consultant,
        workState: 'stale',
        provenance: 'inferred',
      });
    }
  }

  for (const [key, collaborator] of collaborators) {
    if (collaborator.workState === 'active' && collaborator.provenance === 'observed') {
      collaborators.set(key, {
        ...collaborator,
        workState: 'stale',
        provenance: 'inferred',
      });
    }
  }

  return {
    ...leased,
    consultants,
    collaborators,
  };
}

export function projectionsEqual(a: OfficeProjection, b: OfficeProjection): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyWorkObserved(state: OfficeState, fact: CanonicalFact): OfficeState {
  const key = consultantKey(fact.sourceId, fact.conversationId);
  const existing = state.consultants.get(key);
  const generationId = fact.generationId ?? null;

  if (!existing) {
    state.consultants.set(key, {
      conversationId: fact.conversationId,
      sourceId: fact.sourceId,
      workState: 'active',
      provenance: 'observed',
      currentGenerationId: generationId,
      seenGenerationIds: generationId ? [generationId] : [],
      stoppedGenerationIds: [],
      lastObservedAt: fact.receivedAt,
      leaseExpiresAt: leaseFrom(fact.receivedAt),
      labelSuffix: deriveLabelSuffix(fact.sourceId, fact.conversationId),
      accentHue: deriveAccentHue(fact.sourceId, fact.conversationId),
    });
    return state;
  }

  if (generationId && existing.stoppedGenerationIds.includes(generationId)) {
    // Late work for a stopped generation must not reactivate.
    return state;
  }

  if (
    generationId &&
    existing.currentGenerationId !== null &&
    generationId !== existing.currentGenerationId &&
    existing.seenGenerationIds.includes(generationId)
  ) {
    // Older seen generation must not replace the current generation.
    return state;
  }

  const seenGenerationIds = generationId
    ? pushBoundedId(existing.seenGenerationIds, generationId)
    : existing.seenGenerationIds;

  state.consultants.set(key, {
    ...existing,
    workState: 'active',
    provenance: 'observed',
    currentGenerationId: generationId ?? existing.currentGenerationId,
    seenGenerationIds,
    lastObservedAt: fact.receivedAt,
    leaseExpiresAt: leaseFrom(fact.receivedAt),
  });
  return state;
}

function applyGenerationStopped(state: OfficeState, fact: CanonicalFact): OfficeState {
  const key = consultantKey(fact.sourceId, fact.conversationId);
  const existing = state.consultants.get(key);
  if (!existing) {
    return state;
  }

  const stopGen = fact.generationId;
  const stoppedGenerationIds = stopGen
    ? pushBoundedId(existing.stoppedGenerationIds, stopGen)
    : existing.stoppedGenerationIds;

  if (
    stopGen !== undefined &&
    existing.currentGenerationId !== null &&
    stopGen !== existing.currentGenerationId
  ) {
    // Late stop for an older generation — record stopped, leave current active.
    state.consultants.set(key, {
      ...existing,
      stoppedGenerationIds,
    });
    return state;
  }

  if (existing.workState === 'active' || existing.workState === 'stale') {
    state.consultants.set(key, {
      ...existing,
      workState: 'idle',
      provenance: 'observed',
      stoppedGenerationIds,
    });
  } else {
    state.consultants.set(key, {
      ...existing,
      stoppedGenerationIds,
    });
  }

  return state;
}

function applyCollaboratorStarted(state: OfficeState, fact: CanonicalFact): OfficeState {
  const parentId = fact.parentConversationId ?? fact.conversationId;
  const parentKey = consultantKey(fact.sourceId, parentId);
  if (!state.consultants.has(parentKey)) {
    return state;
  }

  const subagentId = fact.subagentId ?? null;
  const collabKey =
    subagentId !== null
      ? `${fact.sourceId}:sub:${subagentId}`
      : `${fact.sourceId}:sub:${parentId}:${fact.fingerprint}`;

  const startedAt = fact.receivedAt;
  state.collaborators.set(collabKey, {
    key: collabKey,
    parentConversationId: parentId,
    subagentId,
    conversationId: fact.conversationId === parentId ? null : fact.conversationId,
    collaboratorType: fact.collaboratorType ?? 'subagent',
    workState: 'active',
    provenance: 'observed',
    startedAt,
    fallbackExpiresAt: collaboratorFallbackFrom(startedAt),
  });
  return state;
}

function applyCollaboratorStopped(state: OfficeState, fact: CanonicalFact): OfficeState {
  const parentId = fact.parentConversationId ?? fact.conversationId;
  const match = findCollaboratorMatch(state, fact, parentId);
  if (!match) {
    return state;
  }
  state.collaborators.delete(match);
  return state;
}

function findCollaboratorMatch(
  state: OfficeState,
  fact: CanonicalFact,
  parentId: string,
): string | null {
  const open = [...state.collaborators.entries()].filter(
    ([, c]) => c.parentConversationId === parentId,
  );

  if (fact.subagentId) {
    const byId = open.find(([, c]) => c.subagentId === fact.subagentId);
    return byId?.[0] ?? null;
  }

  if (fact.conversationId && fact.conversationId !== parentId) {
    const byChild = open.find(([, c]) => c.conversationId === fact.conversationId);
    if (byChild) {
      return byChild[0];
    }
  }

  const type = fact.collaboratorType;
  const typed = type
    ? open.filter(([, c]) => c.collaboratorType === type)
    : open;

  if (typed.length === 1) {
    return typed[0]![0];
  }

  return null;
}
