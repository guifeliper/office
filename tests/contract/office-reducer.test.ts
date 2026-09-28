import { describe, expect, it } from 'vitest';
import type { CanonicalFact } from '../../src/domain/events';
import { COLLABORATOR_FALLBACK_MS, CONSULTANT_LEASE_MS } from '../../src/domain/events';
import {
  createEmptyOfficeState,
  FakeClock,
  isAmbientEligible,
} from '../../src/domain/lifecycle';
import {
  applyFact,
  applyStartupInference,
  evaluateLeases,
  projectOffice,
} from '../../src/domain/office-reducer';

const T0 = 1_700_000_000_000;

function work(partial: Partial<CanonicalFact> & Pick<CanonicalFact, 'conversationId' | 'fingerprint'>): CanonicalFact {
  return {
    kind: 'work_observed',
    sourceId: 'cursor',
    generationId: 'gen-1',
    receivedAt: T0,
    ...partial,
  };
}

function stop(partial: Partial<CanonicalFact> & Pick<CanonicalFact, 'conversationId' | 'fingerprint'>): CanonicalFact {
  return {
    kind: 'generation_stopped',
    sourceId: 'cursor',
    generationId: 'gen-1',
    receivedAt: T0,
    ...partial,
  };
}

describe('office reducer', () => {
  it('AE1: first unique work fact creates one active consultant with observed provenance', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );

    const projection = projectOffice(state);
    expect(projection.consultants).toHaveLength(1);
    const c = projection.consultants[0]!;
    expect(c.conversationId).toBe('conv-a');
    expect(c.workState).toBe('active');
    expect(c.provenance).toBe('observed');
    expect(c.labelSuffix).toHaveLength(4);
  });

  it('AE2: stop for the current generation moves the consultant to idle', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );
    clock.advance(1_000);
    state = applyFact(
      state,
      stop({
        conversationId: 'conv-a',
        fingerprint: 'fp-stop',
        generationId: 'gen-1',
        receivedAt: clock.now(),
      }),
      clock,
    );

    const c = projectOffice(state).consultants[0]!;
    expect(c.workState).toBe('idle');
    expect(c.provenance).toBe('observed');
    expect(isAmbientEligible(c)).toBe(true);
  });

  it('late stop for an older generation leaves the newer generation active', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );
    clock.advance(500);
    state = applyFact(
      state,
      work({
        conversationId: 'conv-a',
        fingerprint: 'fp-2',
        generationId: 'gen-2',
        receivedAt: clock.now(),
      }),
      clock,
    );
    clock.advance(500);
    state = applyFact(
      state,
      stop({
        conversationId: 'conv-a',
        fingerprint: 'fp-late',
        generationId: 'gen-1',
        receivedAt: clock.now(),
      }),
      clock,
    );

    const c = projectOffice(state).consultants[0]!;
    expect(c.workState).toBe('active');
    expect(c.currentGenerationId).toBe('gen-2');
  });

  it('AE3: new activity reactivates the same consultant without duplicating', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );
    state = applyFact(
      state,
      stop({ conversationId: 'conv-a', fingerprint: 'fp-stop', generationId: 'gen-1' }),
      clock,
    );
    clock.advance(60_000);
    state = applyFact(
      state,
      work({
        conversationId: 'conv-a',
        fingerprint: 'fp-3',
        generationId: 'gen-2',
        receivedAt: clock.now(),
      }),
      clock,
    );

    const projection = projectOffice(state);
    expect(projection.consultants).toHaveLength(1);
    expect(projection.consultants[0]!.workState).toBe('active');
    expect(projection.consultants[0]!.currentGenerationId).toBe('gen-2');
  });

  it('AE4: lease evaluation removes a consultant at 24 hours', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );
    clock.advance(CONSULTANT_LEASE_MS);
    state = evaluateLeases(state, clock);

    expect(projectOffice(state).consultants).toHaveLength(0);
  });

  it('duplicate facts and ambient eligibility do not refresh the lease', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );
    const leaseBefore = state.consultants.values().next().value!.leaseExpiresAt;

    clock.advance(5_000);
    state = applyFact(
      state,
      work({
        conversationId: 'conv-a',
        fingerprint: 'fp-1',
        generationId: 'gen-1',
        receivedAt: clock.now(),
      }),
      clock,
    );
    expect(state.consultants.values().next().value!.leaseExpiresAt).toBe(leaseBefore);
    expect(state.consultants.values().next().value!.lastObservedAt).toBe(T0);

    state = applyFact(
      state,
      stop({
        conversationId: 'conv-a',
        fingerprint: 'fp-stop',
        generationId: 'gen-1',
        receivedAt: clock.now(),
      }),
      clock,
    );
    const idle = state.consultants.values().next().value!;
    expect(isAmbientEligible(idle)).toBe(true);
    expect(idle.leaseExpiresAt).toBe(leaseBefore);
  });

  it('collaborator joins its parent and leaves on a matching stop', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'parent', fingerprint: 'fp-p', generationId: 'gen-1' }),
      clock,
    );
    state = applyFact(
      state,
      {
        kind: 'collaborator_started',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        subagentId: 'sub-1',
        collaboratorType: 'explore',
        fingerprint: 'fp-sub-start',
        receivedAt: T0,
        generationId: 'gen-1',
      },
      clock,
    );
    expect(projectOffice(state).collaborators).toHaveLength(1);

    state = applyFact(
      state,
      {
        kind: 'collaborator_stopped',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        subagentId: 'sub-1',
        collaboratorType: 'explore',
        fingerprint: 'fp-sub-stop',
        receivedAt: T0 + 1,
      },
      clock,
    );
    expect(projectOffice(state).collaborators).toHaveLength(0);
    expect(projectOffice(state).consultants[0]!.workState).toBe('active');
  });

  it('subagentStop without subagent_id closes only an unambiguous collaborator', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'parent', fingerprint: 'fp-p', generationId: 'gen-1' }),
      clock,
    );
    state = applyFact(
      state,
      {
        kind: 'collaborator_started',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        subagentId: 'sub-only',
        collaboratorType: 'explore',
        fingerprint: 'fp-sub-a',
        receivedAt: T0,
      },
      clock,
    );
    state = applyFact(
      state,
      {
        kind: 'collaborator_stopped',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        collaboratorType: 'explore',
        fingerprint: 'fp-ambiguous-ok',
        receivedAt: T0 + 1,
      },
      clock,
    );
    expect(projectOffice(state).collaborators).toHaveLength(0);

    // Ambiguous: two open collaborators of same type — stop without id is a no-op leave.
    state = applyFact(
      state,
      {
        kind: 'collaborator_started',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        subagentId: 'sub-1',
        collaboratorType: 'explore',
        fingerprint: 'fp-sub-1',
        receivedAt: T0 + 2,
      },
      clock,
    );
    state = applyFact(
      state,
      {
        kind: 'collaborator_started',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        subagentId: 'sub-2',
        collaboratorType: 'explore',
        fingerprint: 'fp-sub-2',
        receivedAt: T0 + 3,
      },
      clock,
    );
    state = applyFact(
      state,
      {
        kind: 'collaborator_stopped',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        collaboratorType: 'explore',
        fingerprint: 'fp-ambiguous-noop',
        receivedAt: T0 + 4,
      },
      clock,
    );
    expect(projectOffice(state).collaborators).toHaveLength(2);
  });

  it('unmatched collaborator expires after 30 minutes without refreshing parent lease', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'parent', fingerprint: 'fp-p', generationId: 'gen-1' }),
      clock,
    );
    const parentLease = state.consultants.values().next().value!.leaseExpiresAt;
    state = applyFact(
      state,
      {
        kind: 'collaborator_started',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        subagentId: 'sub-1',
        collaboratorType: 'explore',
        fingerprint: 'fp-sub',
        receivedAt: T0,
      },
      clock,
    );
    clock.advance(COLLABORATOR_FALLBACK_MS);
    state = evaluateLeases(state, clock);
    expect(projectOffice(state).collaborators).toHaveLength(0);
    expect(state.consultants.values().next().value!.leaseExpiresAt).toBe(parentLease);
  });

  it('AE8: startup converts unfinished active generation to stale/inferred without moving the lease', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );
    const leaseBefore = state.consultants.values().next().value!.leaseExpiresAt;
    const lastObservedBefore = state.consultants.values().next().value!.lastObservedAt;

    clock.advance(60_000);
    state = applyStartupInference(state, clock);

    const c = projectOffice(state).consultants[0]!;
    expect(c.workState).toBe('stale');
    expect(c.provenance).toBe('inferred');
    expect(c.leaseExpiresAt).toBe(leaseBefore);
    expect(c.lastObservedAt).toBe(lastObservedBefore);
  });

  it('activity after expiry creates a new visit', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );
    clock.advance(CONSULTANT_LEASE_MS);
    state = evaluateLeases(state, clock);
    expect(projectOffice(state).consultants).toHaveLength(0);

    state = applyFact(
      state,
      work({
        conversationId: 'conv-a',
        fingerprint: 'fp-new',
        generationId: 'gen-9',
        receivedAt: clock.now(),
      }),
      clock,
    );
    expect(projectOffice(state).consultants).toHaveLength(1);
    expect(projectOffice(state).consultants[0]!.workState).toBe('active');
  });

  it('stale consultant returns to active on new observed activity', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }),
      clock,
    );
    state = applyStartupInference(state, clock);
    clock.advance(1_000);
    state = applyFact(
      state,
      work({
        conversationId: 'conv-a',
        fingerprint: 'fp-2',
        generationId: 'gen-2',
        receivedAt: clock.now(),
      }),
      clock,
    );
    const c = projectOffice(state).consultants[0]!;
    expect(c.workState).toBe('active');
    expect(c.provenance).toBe('observed');
  });

  it('late work after a stopped generation does not reactivate', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(state, work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }), clock);
    state = applyFact(state, stop({ conversationId: 'conv-a', fingerprint: 'fp-stop', generationId: 'gen-1' }), clock);
    expect(projectOffice(state).consultants[0]!.workState).toBe('idle');

    state = applyFact(
      state,
      work({
        conversationId: 'conv-a',
        fingerprint: 'fp-late-work',
        generationId: 'gen-1',
        receivedAt: clock.now() + 1,
      }),
      clock,
    );
    const c = projectOffice(state).consultants[0]!;
    expect(c.workState).toBe('idle');
    expect(c.currentGenerationId).toBe('gen-1');
  });

  it('older generation cannot replace current; current stop still idles', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(state, work({ conversationId: 'conv-a', fingerprint: 'fp-1', generationId: 'gen-1' }), clock);
    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-2', generationId: 'gen-2', receivedAt: T0 + 1 }),
      clock,
    );
    expect(projectOffice(state).consultants[0]!.currentGenerationId).toBe('gen-2');

    state = applyFact(
      state,
      work({ conversationId: 'conv-a', fingerprint: 'fp-late-g1', generationId: 'gen-1', receivedAt: T0 + 2 }),
      clock,
    );
    expect(projectOffice(state).consultants[0]!.currentGenerationId).toBe('gen-2');
    expect(projectOffice(state).consultants[0]!.workState).toBe('active');

    state = applyFact(
      state,
      stop({ conversationId: 'conv-a', fingerprint: 'fp-stop-g2', generationId: 'gen-2', receivedAt: T0 + 3 }),
      clock,
    );
    const c = projectOffice(state).consultants[0]!;
    expect(c.workState).toBe('idle');
    expect(c.currentGenerationId).toBe('gen-2');
  });

  it('startup marks retained collaborators stale/inferred', () => {
    const clock = new FakeClock(T0);
    let state = createEmptyOfficeState();
    state = applyFact(state, work({ conversationId: 'parent', fingerprint: 'fp-p', generationId: 'gen-1' }), clock);
    state = applyFact(
      state,
      {
        kind: 'collaborator_started',
        sourceId: 'cursor',
        conversationId: 'parent',
        parentConversationId: 'parent',
        subagentId: 'sub-1',
        collaboratorType: 'explore',
        fingerprint: 'fp-sub',
        receivedAt: T0,
      },
      clock,
    );
    state = applyStartupInference(state, clock);
    const collab = projectOffice(state).collaborators[0]!;
    expect(collab.workState).toBe('stale');
    expect(collab.provenance).toBe('inferred');
  });
});
