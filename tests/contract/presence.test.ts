import { describe, expect, it } from 'vitest';
import { DESKS, DOOR_QUEUE, SOUTH_GATE, gridFor, placeConsultant } from '../../src/renderer/office/landmarks';
import { LEISURE_DEFS, LEISURE_ZONE, preferredLeisureKind } from '../../src/renderer/office/leisure';
import { ABSENCE_MS, PresenceDirector, type PresenceConsultant } from '../../src/renderer/office/presence';
import { visibleInScene } from '../../src/renderer/office/scene-visibility';
import { cellAt } from '../../src/renderer/office/world-layout';
import { CONSULTANT_LEASE_MS } from '../../src/domain/events';

const id = 'cursor:arrival';

function consultant(
  partial: Partial<PresenceConsultant> & Pick<PresenceConsultant, 'workState'>,
): PresenceConsultant {
  return {
    id,
    ambientEligible: partial.workState === 'idle',
    ...partial,
  };
}

describe('presence director', () => {
  it('walks a new active consultant in from the south gate toward a desk', () => {
    const director = new PresenceDirector();
    const desk = placeConsultant(id).desk;
    director.sync([consultant({ workState: 'active', ambientEligible: false })]);

    const spawned = director.step(0, false)[0]!;
    expect(spawned.mode).toBe('arrive');
    expect(spawned.y).toBe(SOUTH_GATE.y);
    expect(Math.abs(spawned.x - SOUTH_GATE.x)).toBeLessThanOrEqual(32);
    expect(spawned.bob).toBe(false);

    const walked = director.step(250, false)[0]!;
    expect(walked.moving).toBe(true);
    expect(walked.y).toBeLessThan(spawned.y);

    const arrived = director.step(20_000, false)[0]!;
    expect(arrived.mode).toBe('work');
    expect(arrived.pose).toBe('sit');
    expect(arrived.monitor).toBe('working');
    expect(arrived.bob).toBe(true);
    expect(arrived.moving).toBe(false);
    expect(arrived.x).toBeCloseTo(desk.x);
    expect(arrived.y).toBeCloseTo(desk.y);
    expect(arrived.facing).toBe(desk.facing);
  });

  it('sends idle consultants to leisure and does not replay the gate on reactivation', () => {
    const director = new PresenceDirector();
    const place = placeConsultant(id);
    director.sync([consultant({ workState: 'active', ambientEligible: false })]);
    director.step(20_000, false);

    director.sync([consultant({ workState: 'idle', ambientEligible: true })]);
    const leaving = director.step(0, false)[0]!;
    expect(leaving.mode).toBe('toLeisure');
    expect(leaving.pose).toBe('sit');
    expect(leaving.monitor).toBe('standby');
    expect(leaving.x).toBeCloseTo(place.desk.x);

    const atLeisure = director.step(20_000, false)[0]!;
    expect(atLeisure.mode).toBe('leisure');
    expect(atLeisure.bob).toBe(false);
    expect(atLeisure.x).toBeCloseTo(place.leisure.x);
    expect(atLeisure.y).toBeCloseTo(place.leisure.y);
    expect(Math.hypot(atLeisure.x - place.desk.x, atLeisure.y - place.desk.y)).toBeGreaterThan(40);

    director.sync([consultant({ workState: 'active', ambientEligible: false })]);
    const reactivated = director.step(0, false)[0]!;
    expect(reactivated.mode).toBe('toDesk');
    expect(reactivated.x).toBeCloseTo(place.leisure.x);
    expect(reactivated.y).toBeCloseTo(place.leisure.y);
    expect(Math.hypot(reactivated.x - SOUTH_GATE.x, reactivated.y - SOUTH_GATE.y)).toBeGreaterThan(80);

    const back = director.step(20_000, false)[0]!;
    expect(back.mode).toBe('work');
    expect(back.x).toBeCloseTo(place.desk.x);
    expect(back.bob).toBe(true);
  });

  it('freezes a stale consultant where they are, without a work bob', () => {
    const director = new PresenceDirector();
    director.sync([consultant({ workState: 'active', ambientEligible: false })]);
    director.step(400, false);
    const mid = director.step(0, false)[0]!;

    director.sync([consultant({ workState: 'stale', ambientEligible: false })]);
    const held = director.step(2_000, false)[0]!;
    expect(held.mode).toBe('hold');
    expect(held.x).toBeCloseTo(mid.x);
    expect(held.y).toBeCloseTo(mid.y);
    expect(held.moving).toBe(false);
    expect(held.bob).toBe(false);
    expect(held.pose).toBe('stand');
    expect(held.monitor).toBe('off');
    expect('alpha' in held).toBe(false);
  });

  it('does not walk a restored stale or idle consultant in from the gate', () => {
    const stale = new PresenceDirector();
    const desk = placeConsultant(id).desk;
    stale.sync([consultant({ workState: 'stale', ambientEligible: false })]);
    const frozen = stale.step(1_000, false)[0]!;
    expect(frozen.mode).toBe('hold');
    expect(frozen.pose).toBe('sit');
    expect(frozen.monitor).toBe('standby');
    expect(frozen.x).toBeCloseTo(desk.x);
    expect(frozen.y).toBeCloseTo(desk.y);

    const idle = new PresenceDirector();
    const leisure = placeConsultant(id).leisure;
    idle.sync([consultant({ workState: 'idle', ambientEligible: true })]);
    const resting = idle.step(0, false)[0]!;
    expect(resting.mode).toBe('leisure');
    expect(resting.x).toBeCloseTo(leisure.x);
    expect(resting.y).toBeCloseTo(leisure.y);
  });

  it('snaps to the destination when reduced motion is on', () => {
    const director = new PresenceDirector();
    const desk = placeConsultant(id).desk;
    director.sync([consultant({ workState: 'active', ambientEligible: false })]);
    const snapped = director.step(0, true)[0]!;
    expect(snapped.x).toBeCloseTo(desk.x);
    expect(snapped.y).toBeCloseTo(desk.y);
    expect(snapped.moving).toBe(false);
    expect(snapped.bob).toBe(false);
    expect(snapped.mode).toBe('work');
    expect(snapped.pose).toBe('sit');
    expect(snapped.monitor).toBe('working');
  });

  it('seats 16 concurrent consultants at 16 distinct desks', () => {
    const director = new PresenceDirector();
    const ids = Array.from({ length: 16 }, (_, i) => `cursor:seat-${i}`);
    director.sync(ids.map((seat) => ({ id: seat, workState: 'active', ambientEligible: false })));
    const seated = director.step(0, true);
    expect(new Set(seated.map((snap) => `${snap.x},${snap.y}`)).size).toBe(16);
    for (const snap of seated) {
      expect(DESKS.some((desk) => desk.x === snap.x && desk.y === snap.y)).toBe(true);
    }
  });

  it('never stands on a solid cell while walking in', () => {
    const director = new PresenceDirector();
    director.sync([consultant({ workState: 'active', ambientEligible: false })]);
    const zones = new Set<string>();
    for (let frame = 0; frame < 900; frame += 1) {
      const snap = director.step(33, false)[0]!;
      const cell = cellAt(snap.x, snap.y);
      expect(gridFor(snap.zone).walkable(cell.col, cell.row)).toBe(true);
      zones.add(snap.zone);
      if (snap.mode === 'work') break;
    }
    const seated = director.step(0, false)[0]!;
    expect(seated.mode).toBe('work');
    expect(seated.zone).toBe('cabin');
    expect([...zones]).toEqual(['yard', 'cabin']);
  });

  it('keeps identity, desk, and monitor phase across the door', () => {
    const outdoorsy = Array.from({ length: 50 }, (_, i) => `cursor:out-${i}`)
      .find((candidate) => LEISURE_ZONE[preferredLeisureKind(candidate)] === 'yard')!;
    const director = new PresenceDirector();
    director.sync([{ id: outdoorsy, workState: 'active', ambientEligible: false }]);
    const at = director.step(20_000, false)[0]!;
    expect(at.zone).toBe('cabin');
    const desk = at.deskIndex;
    director.sync([{ id: outdoorsy, workState: 'idle', ambientEligible: true }]);
    const outside = director.step(30_000, false)[0]!;
    expect(outside.zone).toBe('yard');
    expect(outside.mode).toBe('leisure');
    expect(outside.monitor).toBe('off');
    director.sync([{ id: outdoorsy, workState: 'active', ambientEligible: false }]);
    const back = director.step(30_000, false)[0]!;
    expect(back.id).toBe(outdoorsy);
    expect(back.zone).toBe('cabin');
    expect(back.deskIndex).toBe(desk);
    expect(back.monitor).toBe('working');
  });

  it('seats a collaborator at their own desk, and queues them at the door when the 16 are full', () => {
    const director = new PresenceDirector();
    const parent = 'cursor:parent-conversation';
    const child = 'cursor:sub:subagent-9';
    director.sync([
      { id: parent, workState: 'active', ambientEligible: false },
      { id: child, workState: 'active', ambientEligible: false },
    ]);
    const seated = director.step(0, true);
    const parentSnap = seated.find((snap) => snap.id === parent)!;
    const childSnap = seated.find((snap) => snap.id === child)!;
    expect(parentSnap.pose).toBe('sit');
    expect(childSnap.pose).toBe('sit');
    expect(childSnap.deskIndex).toBeGreaterThanOrEqual(0);
    expect(childSnap.deskIndex).not.toBe(parentSnap.deskIndex);
    expect(childSnap.monitor).toBe('working');

    const full = new PresenceDirector();
    const ids = Array.from({ length: 16 }, (_, i) => `cursor:seat-${i}`);
    full.sync([
      ...ids.map((seat) => ({ id: seat, workState: 'active' as const, ambientEligible: false })),
      { id: child, workState: 'active', ambientEligible: false },
    ]);
    const overflow = full.step(0, true).find((snap) => snap.id === child)!;
    expect(overflow.deskIndex).toBe(-1);
    expect(overflow.mode).toBe('overflow');
    expect(overflow.pose).toBe('stand');
    expect(overflow.monitor).toBe('off');
    expect(DESKS.some((desk) => desk.x === overflow.x && desk.y === overflow.y)).toBe(false);
    expect(DOOR_QUEUE.some((spot) => spot.x === overflow.x && spot.y === overflow.y)).toBe(true);

    full.sync([
      { id: ids[0]!, workState: 'active', ambientEligible: false },
      { id: child, workState: 'active', ambientEligible: false },
    ]);
    const claimed = full.step(0, true).find((snap) => snap.id === child)!;
    expect(claimed.pose).toBe('sit');
    expect(claimed.deskIndex).toBeGreaterThanOrEqual(0);
  });

  it('tracks several consultants and drops ones that leave', () => {
    const director = new PresenceDirector();
    director.sync([
      { id: 'cursor:a', workState: 'active', ambientEligible: false },
      { id: 'cursor:b', workState: 'idle', ambientEligible: true },
    ]);
    const both = director.step(0, false);
    expect(both).toHaveLength(2);
    expect(both.map((snap) => snap.id)).toEqual(['cursor:a', 'cursor:b']);

    director.sync([{ id: 'cursor:b', workState: 'idle', ambientEligible: true }]);
    expect(director.step(16, false).map((snap) => snap.id)).toEqual(['cursor:b']);
  });

  it('seats at most 16, queues at most 4, and leaves old idle and stale off the canvas', () => {
    const now = 10_000_000;
    const old = now - ABSENCE_MS - 1;
    const people = [
      ...Array.from({ length: 22 }, (_, i) => ({
        id: `cursor:active-${i}`,
        workState: 'active' as const,
        ambientEligible: false,
        lastObservedAt: now,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `cursor:idle-${i}`,
        workState: 'idle' as const,
        ambientEligible: true,
        lastObservedAt: now,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `cursor:stale-fresh-${i}`,
        workState: 'stale' as const,
        ambientEligible: false,
        lastObservedAt: now,
      })),
      ...Array.from({ length: 14 }, (_, i) => ({
        id: `cursor:idle-old-${i}`,
        workState: 'idle' as const,
        ambientEligible: true,
        lastObservedAt: old,
      })),
      ...Array.from({ length: 14 }, (_, i) => ({
        id: `cursor:stale-old-${i}`,
        workState: 'stale' as const,
        ambientEligible: false,
        lastObservedAt: old,
      })),
    ];
    expect(people).toHaveLength(60);

    const director = new PresenceDirector();
    director.sync(people, now);
    const canvas = director.step(0, true, now);
    const cells = canvas.map((snap) => {
      const cell = cellAt(snap.x, snap.y);
      return `${snap.zone}:${cell.col},${cell.row}`;
    });
    const seated = canvas.filter((snap) => snap.deskIndex >= 0 && snap.pose === 'sit');
    const queued = canvas.filter((snap) => snap.mode === 'overflow');
    const leisure = canvas.filter((snap) => snap.mode === 'leisure' || (snap.mode === 'hold' && snap.deskIndex < 0));

    expect(seated).toHaveLength(DESKS.length);
    expect(queued).toHaveLength(DOOR_QUEUE.length);
    expect(leisure.length).toBeLessThanOrEqual(LEISURE_DEFS.length);
    expect(new Set(cells).size).toBe(canvas.length);
    expect(canvas.some((snap) => snap.id.startsWith('cursor:idle-old-'))).toBe(false);
    expect(canvas.some((snap) => snap.id.startsWith('cursor:stale-old-'))).toBe(false);
    expect(canvas.some((snap) => snap.id === 'cursor:active-20')).toBe(false);
  });

  it('hides a courtyard consultant from the cabin scene, and the reverse', () => {
    const yardId = Array.from({ length: 40 }, (_, i) => `cursor:yard-${i}`).find((seat) => {
      const kind = preferredLeisureKind(seat);
      return kind === 'woodpile' || kind === 'garden';
    })!;
    const cabinId = Array.from({ length: 40 }, (_, i) => `cursor:cabin-${i}`).find((seat) => (
      preferredLeisureKind(seat) === 'hearth'
    ))!;

    const outdoors = new PresenceDirector();
    outdoors.sync([{ id: yardId, workState: 'idle', ambientEligible: true }]);
    const yard = outdoors.step(0, true)[0]!;
    expect(yard.zone).toBe('yard');
    expect(visibleInScene('cabin', yard)).toBe(false);
    expect(visibleInScene('yard', yard)).toBe(true);

    const indoors = new PresenceDirector();
    indoors.sync([{ id: cabinId, workState: 'idle', ambientEligible: true }]);
    const cabin = indoors.step(0, true)[0]!;
    expect(cabin.zone).toBe('cabin');
    expect(visibleInScene('yard', cabin)).toBe(false);
    expect(visibleInScene('cabin', cabin)).toBe(true);
  });

  it('sends an idle consultant out after fifteen quiet minutes and back in through the gate', () => {
    expect(CONSULTANT_LEASE_MS).toBe(24 * 60 * 60 * 1000);
    expect(ABSENCE_MS).toBe(15 * 60_000);

    const now = 1_000_000;
    const director = new PresenceDirector();
    director.sync([consultant({ workState: 'idle', lastObservedAt: now })]);
    expect(director.step(0, true, now + ABSENCE_MS - 1)[0]?.mode).toBe('leisure');

    director.sync([consultant({ workState: 'active', ambientEligible: false, lastObservedAt: now + ABSENCE_MS - 1 })]);
    const returned = director.step(0, true, now + ABSENCE_MS - 1)[0]!;
    expect(returned.mode).toBe('work');
    expect(returned.pose).toBe('sit');
    expect(returned.y).not.toBe(SOUTH_GATE.y);

    director.sync([consultant({ workState: 'idle', lastObservedAt: now })]);
    director.step(0, true, now);
    expect(director.step(0, true, now + ABSENCE_MS)).toEqual([]);

    director.sync([consultant({ workState: 'active', ambientEligible: false, lastObservedAt: now + ABSENCE_MS })]);
    const reentered = director.step(0, false, now + ABSENCE_MS)[0]!;
    expect(reentered.mode).toBe('arrive');
    expect(reentered.y).toBe(SOUTH_GATE.y);
  });

  it('never auto-departs an active or stale consultant, or a parent with an active collaborator', () => {
    const now = 5_000_000;
    const quiet = now - ABSENCE_MS - 1;

    const active = new PresenceDirector();
    active.sync([{ id: 'cursor:busy', workState: 'active', ambientEligible: false, lastObservedAt: quiet }]);
    expect(active.step(0, true, now).map((snap) => snap.mode)).toEqual(['work']);

    const stale = new PresenceDirector();
    stale.sync([{ id: 'cursor:old', workState: 'stale', ambientEligible: false, lastObservedAt: quiet }]);
    expect(stale.step(0, true, now)).toEqual([]);

    const recent = new PresenceDirector();
    recent.sync([{ id: 'cursor:recent', workState: 'stale', ambientEligible: false, lastObservedAt: now }]);
    expect(recent.step(0, true, now).map((snap) => snap.mode)).toEqual(['hold']);

    const parent = new PresenceDirector();
    parent.sync([
      { id: 'cursor:parent', workState: 'idle', ambientEligible: true, lastObservedAt: now },
      { id: 'cursor:child', workState: 'active', ambientEligible: false, parentId: 'cursor:parent', lastObservedAt: now },
    ]);
    parent.step(0, true, now);
    const kept = parent.step(0, true, now + ABSENCE_MS).find((snap) => snap.id === 'cursor:parent')!;
    expect(kept).toBeDefined();
    expect(kept.mode).not.toBe('depart');

    const launched = new PresenceDirector();
    launched.sync([
      { id: 'cursor:parent', workState: 'idle', ambientEligible: true, lastObservedAt: quiet },
    ]);
    expect(launched.step(0, true, now)).toEqual([]);
  });
});
