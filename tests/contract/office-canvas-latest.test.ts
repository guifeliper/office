import { describe, expect, it } from 'vitest';
import type { Consultant } from '../../src/domain/lifecycle';
import type { LatestOfficeProps } from '../../src/renderer/office/OfficeCanvas';
import { viewFromLatest } from '../../src/renderer/office/OfficeCanvas';

function consultant(conversationId: string, suffix: string): Consultant {
  return {
    sourceId: 'cursor',
    conversationId,
    workState: 'active',
    provenance: 'observed',
    currentGenerationId: 'gen-1',
    seenGenerationIds: ['gen-1'],
    stoppedGenerationIds: [],
    lastObservedAt: 1,
    leaseExpiresAt: 2,
    labelSuffix: suffix,
    accentHue: 10,
  };
}

describe('OfficeCanvas latest projection', () => {
  it('resize/async init reads the latest projection, not an empty mount closure', () => {
    const empty: LatestOfficeProps = {
      projection: { consultants: [], collaborators: [] },
      connected: false,
    };
    const occupied: LatestOfficeProps = {
      projection: {
        consultants: [consultant('keep', 'KEEP')],
        collaborators: [],
      },
      connected: true,
    };

    // Simulate: mount started with empty, then projection arrived, then resize/init completes.
    const latest = { current: empty };
    latest.current = occupied;

    const afterSlowInit = viewFromLatest(latest.current, 800, 600);
    expect(afterSlowInit.consultants).toHaveLength(1);
    expect(afterSlowInit.consultants[0]!.label).toBe('Consultant · KEEP');
    expect(afterSlowInit.waitingForActivity).toBe(false);

    const afterResize = viewFromLatest(latest.current, 1200, 900);
    expect(afterResize.consultants).toHaveLength(1);
    expect(afterResize.consultants[0]!.conversationId).toBe('keep');
  });
});
