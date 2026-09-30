import { describe, expect, it } from 'vitest';
import { DESKS, SOUTH_GATE, gridFor, placeConsultant, waypointFor } from '../../src/renderer/office/landmarks';
import { LEISURE_DEFS, LEISURE_ZONE, preferredLeisureKind } from '../../src/renderer/office/leisure';
import { cellAt } from '../../src/renderer/office/world-layout';
import {
  PresenceDirector,
  type PresenceConsultant,
} from '../../src/renderer/office/presence';

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

  it('seats a collaborator at their own desk, and stands them at leisure when the 16 are full', () => {
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
    expect(LEISURE_DEFS.some((spot) => {
      const at = waypointFor(spot);
      return at.x === overflow.x && at.y === overflow.y;
    })).toBe(true);

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
});
