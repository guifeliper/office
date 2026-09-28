import type { Collaborator, Consultant } from '../../domain/lifecycle';
import type { OfficeProjection } from '../../domain/office-reducer';

export type ProvenanceBadge = 'observed' | 'inferred' | 'ambient' | 'stale';

export interface ConsultantViewModel {
  id: string;
  conversationId: string;
  label: string;
  accentHue: number;
  workState: Consultant['workState'];
  provenance: Consultant['provenance'];
  badge: ProvenanceBadge;
  ambientEligible: boolean;
  x: number;
  y: number;
}

export interface CollaboratorViewModel {
  id: string;
  parentId: string;
  label: string;
  workState: Collaborator['workState'];
  provenance: Collaborator['provenance'];
  badge: ProvenanceBadge;
  x: number;
  y: number;
}

export interface OfficeViewModel {
  consultants: ConsultantViewModel[];
  collaborators: CollaboratorViewModel[];
  waitingForActivity: boolean;
  connected: boolean;
}

export function toOfficeViewModel(
  projection: OfficeProjection,
  options: { connected: boolean; width: number; height: number },
): OfficeViewModel {
  const { width, height } = options;
  const deskY = height * 0.55;
  const startX = Math.max(80, width * 0.15);
  const gap = Math.min(160, Math.max(100, (width * 0.7) / Math.max(1, projection.consultants.length)));

  const consultants: ConsultantViewModel[] = projection.consultants.map((c, index) => {
    const badge = badgeFor(c);
    return {
      id: `${c.sourceId}:${c.conversationId}`,
      conversationId: c.conversationId,
      label: `Consultant · ${c.labelSuffix}`,
      accentHue: c.accentHue,
      workState: c.workState,
      provenance: c.provenance,
      badge,
      ambientEligible: c.workState === 'idle' && c.provenance === 'observed',
      x: startX + index * gap,
      y: deskY,
    };
  });

  const byParent = new Map(consultants.map((c) => [c.conversationId, c]));
  const collaborators: CollaboratorViewModel[] = projection.collaborators.map((collab, index) => {
    const parent = byParent.get(collab.parentConversationId);
    const px = parent?.x ?? startX;
    const py = parent?.y ?? deskY;
    return {
      id: collab.key,
      parentId: collab.parentConversationId,
      label: collab.collaboratorType,
      workState: collab.workState,
      provenance: collab.provenance,
      badge: collab.provenance === 'inferred' ? 'inferred' : 'observed',
      x: px + 36 + (index % 3) * 18,
      y: py + 28 + Math.floor(index / 3) * 16,
    };
  });

  return {
    consultants,
    collaborators,
    waitingForActivity: options.connected && consultants.length === 0,
    connected: options.connected,
  };
}

function badgeFor(c: Consultant): ProvenanceBadge {
  if (c.workState === 'stale') return 'stale';
  if (c.provenance === 'inferred') return 'inferred';
  if (c.workState === 'idle') return 'observed';
  return c.provenance;
}
