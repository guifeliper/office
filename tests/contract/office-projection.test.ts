import { describe, expect, it } from 'vitest';
import type { Collaborator, Consultant } from '../../src/domain/lifecycle';
import { AmbientDirector } from '../../src/renderer/office/ambient-director';
import { toOfficeViewModel } from '../../src/renderer/office/projection';

function consultant(partial: Partial<Consultant> & Pick<Consultant, 'conversationId'>): Consultant {
  return {
    sourceId: 'cursor',
    workState: 'active',
    provenance: 'observed',
    currentGenerationId: 'gen-1',
    seenGenerationIds: ['gen-1'],
    stoppedGenerationIds: [],
    lastObservedAt: 1000,
    leaseExpiresAt: 1000 + 86_400_000,
    labelSuffix: 'AB12',
    accentHue: 40,
    ...partial,
  };
}

describe('office projection view model', () => {
  it('renders distinct truthful states and stable labels without conversation content', () => {
    const view = toOfficeViewModel(
      {
        consultants: [
          consultant({ conversationId: 'c1', labelSuffix: 'AAAA', accentHue: 10, workState: 'active' }),
          consultant({
            conversationId: 'c2',
            labelSuffix: 'BBBB',
            accentHue: 200,
            workState: 'idle',
            provenance: 'observed',
          }),
          consultant({
            conversationId: 'c3',
            labelSuffix: 'CCCC',
            workState: 'stale',
            provenance: 'inferred',
          }),
        ],
        collaborators: [],
      },
      { connected: true, width: 1200, height: 800 },
    );

    expect(view.consultants).toHaveLength(3);
    expect(view.consultants[0]!.label).toBe('Consultant · AAAA');
    expect(view.consultants[1]!.label).toBe('Consultant · BBBB');
    expect(view.consultants[0]!.badge).toBe('observed');
    expect(view.consultants[1]!.ambientEligible).toBe(true);
    expect(view.consultants[1]!.badge).toBe('ambient');
    expect(view.consultants[2]!.badge).toBe('stale');
    expect(view.consultants.map((c) => c.label).join(' ')).not.toContain('c1');
    expect(view.consultants[0]!.accentHue).not.toBe(view.consultants[1]!.accentHue);
  });

  it('groups collaborators near parents and leaves without inventing occupants when empty', () => {
    const parent = consultant({ conversationId: 'parent', labelSuffix: 'PAR1' });
    const collab: Collaborator = {
      key: 'cursor:sub:s1',
      parentConversationId: 'parent',
      subagentId: 's1',
      conversationId: null,
      collaboratorType: 'explore',
      workState: 'active',
      provenance: 'observed',
      startedAt: 1,
      fallbackExpiresAt: 2,
    };

    const withCollab = toOfficeViewModel(
      { consultants: [parent], collaborators: [collab] },
      { connected: true, width: 1000, height: 700 },
    );
    expect(withCollab.collaborators).toHaveLength(1);
    expect(withCollab.collaborators[0]!.x).toBeGreaterThan(withCollab.consultants[0]!.x);
    expect(withCollab.collaborators[0]!.label).toBe('explore');

    const empty = toOfficeViewModel(
      { consultants: [], collaborators: [] },
      { connected: true, width: 1000, height: 700 },
    );
    expect(empty.waitingForActivity).toBe(true);
    expect(empty.consultants).toHaveLength(0);
  });

  it('ambient director never mutates domain timestamps and respects reduced motion', () => {
    const lastObservedAt = 5000;
    const leaseExpiresAt = 9000;
    const c = consultant({
      conversationId: 'idle-1',
      workState: 'idle',
      provenance: 'observed',
      lastObservedAt,
      leaseExpiresAt,
      labelSuffix: 'IDLE',
    });
    const view = toOfficeViewModel(
      { consultants: [c], collaborators: [] },
      { connected: true, width: 800, height: 600 },
    );

    const director = new AmbientDirector();
    const moving = director.tick(16, [view.consultants[0]!.id], false);
    expect(moving[0]!.behavior).toBeTruthy();
    expect(Math.abs(moving[0]!.offsetX) + Math.abs(moving[0]!.offsetY)).toBeGreaterThan(0);

    const resting = director.tick(16, [view.consultants[0]!.id], true);
    expect(resting[0]!.behavior).toBe('rest');
    expect(resting[0]!.offsetX).toBe(0);

    // Domain object untouched.
    expect(c.lastObservedAt).toBe(lastObservedAt);
    expect(c.leaseExpiresAt).toBe(leaseExpiresAt);

    director.interrupt(view.consultants[0]!.id);
    expect(director.tick(16, [], false)).toHaveLength(0);
  });
});
