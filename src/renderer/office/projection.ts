import type { Collaborator, Consultant } from '../../domain/lifecycle';
import type { OfficeProjection } from '../../domain/office-reducer';
import type { Facing } from './landmarks';
import { placeConsultant } from './landmarks';

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
  /** Epoch ms of the last work_observed. Presence measures the 15-minute absence from this. */
  lastObservedAt: number;
  /** Desk anchor in world pixels. Live position is owned by the presence director. */
  x: number;
  y: number;
  facing: Facing;
}

export interface CollaboratorViewModel {
  id: string;
  /** Paper-doll seed. subagent id when the projection has one; otherwise the collaborator key. */
  appearanceId: string;
  parentId: string;
  /** Parent accent, for the small map pip. Null when the parent is not on the floor. */
  parentHue: number | null;
  label: string;
  workState: Collaborator['workState'];
  provenance: Collaborator['provenance'];
  badge: ProvenanceBadge;
  /** Epoch ms of the collaborator's start. Presence ages stale collaborators from this. */
  lastObservedAt: number;
  /** Preferred desk. Presence assigns a free chair; this is not a follow offset. */
  x: number;
  y: number;
}

/**
 * Collaborators render at full size. They are their own character, not a scaled copy of the parent.
 */
export const COLLABORATOR_SCALE = 1;

/**
 * Seed for `appearanceFromSeed`.
 * `subagentId` stays the same for that subagent and is not the parent's conversation id.
 * Without one, the projection key (`source:sub:parentId:fingerprint`) is the most stable id we have.
 */
export function collaboratorAppearanceId(collab: Pick<Collaborator, 'subagentId' | 'key'>): string {
  return collab.subagentId ?? collab.key;
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
  // Desk anchors are world pixels on the sketch. Viewport size only feeds the camera.
  void options.width;
  void options.height;

  const consultants: ConsultantViewModel[] = projection.consultants.map((c) => {
    const id = `${c.sourceId}:${c.conversationId}`;
    const place = placeConsultant(id);
    const badge = badgeFor(c);
    return {
      id,
      conversationId: c.conversationId,
      label: `Consultant · ${c.labelSuffix}`,
      accentHue: c.accentHue,
      workState: c.workState,
      provenance: c.provenance,
      badge,
      ambientEligible: c.workState === 'idle' && c.provenance === 'observed',
      lastObservedAt: c.lastObservedAt,
      x: place.desk.x,
      y: place.desk.y,
      facing: place.desk.facing,
    };
  });

  const byParent = new Map(consultants.map((c) => [c.conversationId, c]));
  const collaborators: CollaboratorViewModel[] = projection.collaborators.map((collab) => {
    const parent = byParent.get(collab.parentConversationId);
    const appearanceId = collaboratorAppearanceId(collab);
    const place = placeConsultant(appearanceId);
    return {
      id: collab.key,
      appearanceId,
      parentId: collab.parentConversationId,
      parentHue: parent?.accentHue ?? null,
      label: collab.collaboratorType,
      workState: collab.workState,
      provenance: collab.provenance,
      badge: collaboratorBadge(collab),
      lastObservedAt: collab.startedAt,
      x: place.desk.x,
      y: place.desk.y,
    };
  });

  return {
    consultants,
    collaborators,
    waitingForActivity: options.connected && consultants.length === 0,
    connected: options.connected,
  };
}

function collaboratorBadge(collab: Collaborator): ProvenanceBadge {
  if (collab.workState === 'stale') return 'stale';
  if (collab.provenance === 'inferred') return 'inferred';
  return 'observed';
}

export interface RosterEntry {
  id: string;
  label: string;
  badge: ProvenanceBadge;
  children: RosterEntry[];
}

/** Consultants, with their collaborators indented underneath. The badge color matches the map dot. */
export function rosterRows(projection: OfficeProjection): RosterEntry[] {
  const byParent = new Map<string, Collaborator[]>();
  const visibleCollaborators = projection.collaborators.filter((collab) => collab.workState !== 'stale');
  for (const collab of visibleCollaborators) {
    const list = byParent.get(collab.parentConversationId) ?? [];
    list.push(collab);
    byParent.set(collab.parentConversationId, list);
  }
  const visibleConsultants = projection.consultants.filter((consultant) => consultant.workState !== 'stale');
  const known = new Set(visibleConsultants.map((c) => c.conversationId));
  const rows: RosterEntry[] = visibleConsultants.map((consultant) => ({
    id: `${consultant.sourceId}:${consultant.conversationId}`,
    label: `Consultant · ${consultant.labelSuffix}`,
    badge: badgeFor(consultant),
    children: (byParent.get(consultant.conversationId) ?? []).map((collab) => ({
      id: collab.key,
      label: collab.collaboratorType,
      badge: collaboratorBadge(collab),
      children: [],
    })),
  }));
  for (const [parentId, collabs] of byParent) {
    if (known.has(parentId)) continue;
    for (const collab of collabs) {
      rows.push({
        id: collab.key,
        label: collab.collaboratorType,
        badge: collaboratorBadge(collab),
        children: [],
      });
    }
  }
  return rows;
}

/** Active bodies past the 16 desks and the 4 door spots. They stay in the roster. */
export function waitingCount(projection: OfficeProjection): number {
  const active = projection.consultants.filter((c) => c.workState === 'active').length
    + projection.collaborators.filter((c) => c.workState === 'active').length;
  return Math.max(0, active - 20);
}

function badgeFor(c: Consultant): ProvenanceBadge {
  if (c.workState === 'stale') return 'stale';
  if (c.provenance === 'inferred') return 'inferred';
  // Idle observed consultants perform ambient locomotion — badge must say so (R12).
  if (c.workState === 'idle' && c.provenance === 'observed') return 'ambient';
  return c.provenance;
}
