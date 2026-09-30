import { describe, expect, it } from 'vitest';
import type { Collaborator, Consultant } from '../../src/domain/lifecycle';
import { placeConsultant } from '../../src/renderer/office/landmarks';
import { appearanceFromSeed, appearanceKey } from '../../src/renderer/office/paper-doll';
import {
  COLLABORATOR_SCALE,
  collaboratorAppearanceId,
  rosterRows,
  toOfficeViewModel,
} from '../../src/renderer/office/projection';

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
    expect(view.consultants[0]!.x).toBe(placeConsultant(view.consultants[0]!.id).desk.x);
    expect(view.consultants[0]!.y).toBe(placeConsultant(view.consultants[0]!.id).desk.y);
  });

  it('keeps desk anchors in world space when the viewport changes', () => {
    const projection = {
      consultants: [consultant({ conversationId: 'c1', labelSuffix: 'AAAA' })],
      collaborators: [],
    };
    const small = toOfficeViewModel(projection, { connected: true, width: 800, height: 600 });
    const large = toOfficeViewModel(projection, { connected: true, width: 1600, height: 1000 });
    expect(large.consultants[0]!.x).toBe(small.consultants[0]!.x);
    expect(large.consultants[0]!.y).toBe(small.consultants[0]!.y);
  });

  it('seeds a collaborator from their own id, at full size, indented under the parent', () => {
    const parent = consultant({ conversationId: 'parent-conversation', labelSuffix: 'PAR1', accentHue: 40 });
    const collab: Collaborator = {
      key: 'cursor:sub:subagent-9',
      parentConversationId: 'parent-conversation',
      subagentId: 'subagent-9',
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
    const child = withCollab.collaborators[0]!;
    expect(child.appearanceId).toBe('subagent-9');
    expect(child.appearanceId).not.toBe(parent.conversationId);
    expect(appearanceKey(appearanceFromSeed(child.appearanceId))).not.toBe(
      appearanceKey(appearanceFromSeed(parent.conversationId)),
    );
    expect(appearanceKey(appearanceFromSeed(child.appearanceId))).toBe(
      appearanceKey(appearanceFromSeed('subagent-9')),
    );
    expect(child.x).toBe(placeConsultant(child.appearanceId).desk.x);
    expect(child.y).toBe(placeConsultant(child.appearanceId).desk.y);
    expect(child.parentHue).toBe(40);
    expect(COLLABORATOR_SCALE).toBe(1);

    const rows = rosterRows({ consultants: [parent], collaborators: [collab] });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.children).toHaveLength(1);
    expect(rows[0]!.children[0]!.label).toBe('explore');
    expect(rows[0]!.children[0]!.badge).toBe(rows[0]!.badge);

    const withoutSubagent: Collaborator = { ...collab, subagentId: null, key: 'cursor:sub:parent-conversation:fp1' };
    expect(collaboratorAppearanceId(withoutSubagent)).toBe('cursor:sub:parent-conversation:fp1');
    expect(collaboratorAppearanceId(withoutSubagent)).not.toBe('parent-conversation');

    const empty = toOfficeViewModel(
      { consultants: [], collaborators: [] },
      { connected: true, width: 1000, height: 700 },
    );
    expect(empty.waitingForActivity).toBe(true);
    expect(empty.consultants).toHaveLength(0);
  });

  it('omits stale retained history from the visible roster', () => {
    const current = consultant({ conversationId: 'current', labelSuffix: 'LIVE', workState: 'active' });
    const old = consultant({ conversationId: 'old', labelSuffix: 'OLD1', workState: 'stale' });
    const rows = rosterRows({ consultants: [current, old], collaborators: [] });
    expect(rows.map((row) => row.label)).toEqual(['Consultant · LIVE']);
  });
});
