import { describe, expect, it } from 'vitest';
import {
  LEISURE_CAPACITY,
  LEISURE_HOLD_MS,
  LEISURE_STEP_MS,
  assignLeisure,
  conversationKey,
  leisureFrameIndex,
  leisureKey,
  preferredLeisureKind,
} from '../../src/renderer/office/leisure';
import { PresenceDirector } from '../../src/renderer/office/presence';

describe('leisure assignment', () => {
  it('gives the same id the same activity every time', () => {
    const first = assignLeisure('cursor:room-a', new Set())!;
    const second = assignLeisure('cursor:room-a', new Set())!;
    expect(first.kind).toBe(second.kind);
    expect(leisureKey(first)).toBe(leisureKey(second));
    expect(preferredLeisureKind('cursor:room-a')).toBe(first.kind);
  });

  it('gives the same conversation the same preferred activity', () => {
    expect(conversationKey('alice:sprint-14')).toBe('sprint-14');
    expect(preferredLeisureKind('alice:sprint-14')).toBe(preferredLeisureKind('bob:sprint-14'));
  });

  it('fills one activity then spills to the next', () => {
    const conversation = 'same-room';
    const preferred = preferredLeisureKind(`0:${conversation}`);
    const taken = new Set<string>();
    const kinds: string[] = [];
    const seats = LEISURE_CAPACITY[preferred];
    for (let i = 0; i < seats + 1; i += 1) {
      const slot = assignLeisure(`${i}:${conversation}`, taken)!;
      kinds.push(slot.kind);
      taken.add(leisureKey(slot));
    }
    expect(kinds.slice(0, seats).every((kind) => kind === preferred)).toBe(true);
    expect(kinds[seats]).not.toBe(preferred);
  });
});

describe('leisure frames', () => {
  it('holds the axe on frame 0 between swings', () => {
    const swing = 6 * LEISURE_STEP_MS.woodpile;
    expect(leisureFrameIndex('woodpile', 0, true)).toBe(0);
    expect(leisureFrameIndex('woodpile', LEISURE_STEP_MS.woodpile, true)).toBe(1);
    expect(leisureFrameIndex('woodpile', swing + 10, true)).toBe(0);
    expect(leisureFrameIndex('woodpile', swing + LEISURE_HOLD_MS - 1, true)).toBe(0);
  });

  it('stays on frame 0 when play is off (stale or reduced motion)', () => {
    expect(leisureFrameIndex('hearth', 900, false)).toBe(0);
    expect(leisureFrameIndex('coffee', 900, false)).toBe(0);
    expect(leisureFrameIndex('garden', 900, false)).toBe(0);
    expect(leisureFrameIndex('woodpile', 900, false)).toBe(0);
  });
});

describe('presence leisure flags', () => {
  it('never plays a leisure pose on stale', () => {
    const director = new PresenceDirector();
    director.sync([{ id: 'cursor:stale-desk', workState: 'stale', ambientEligible: false }]);
    const snap = director.step(1_000, false)[0]!;
    expect(snap.mode).toBe('hold');
    expect(snap.leisure).toBeNull();
    expect(snap.leisureMotion).toBe(false);
  });

  it('keeps reduced motion on a still leisure frame', () => {
    const director = new PresenceDirector();
    director.sync([{ id: 'cursor:idle-rest', workState: 'idle', ambientEligible: true }]);
    const snap = director.step(0, true)[0]!;
    expect(snap.mode).toBe('leisure');
    expect(snap.leisure).toBe(preferredLeisureKind('cursor:idle-rest'));
    expect(snap.leisureMotion).toBe(false);
  });
});
