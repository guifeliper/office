import { describe, expect, it } from 'vitest';
import { butterflyAway } from '../../src/renderer/office/butterflies';
import { ABSENCE_MS, type PresenceSnapshot } from '../../src/renderer/office/presence';
import { CABIN_NAV, NAV, routeTo } from '../../src/renderer/office/landmarks';
import { HEARTH_CHAIR_CELLS } from '../../src/renderer/office/cabin-layout';
import { CAST_FRAMES, CAST_ROW } from '../../src/renderer/office/tiny-farm-cast';
import { ErrandBoard } from '../../src/renderer/office/errand-board';
import { STATIONS, pickOne, stationKey, stationWaypoint } from '../../src/renderer/office/errand-stations';
import { WOOD_CHOP_MS, WOOD_DROP_MS, WOOD_LIFT_MS, WOOD_REST_MS, initialWood, stepWood, woodPose, woodTravels } from '../../src/renderer/office/wood-cycle';
import { PET_MS, PET_REST_MS, initialPet, petPose, stepPet } from '../../src/renderer/office/pet-cycle';
import { BUG_PERIOD_MS, BUG_SWING_MS, bugPose, chaseDue, initialBug, stepBug } from '../../src/renderer/office/bug-cycle';
import { SLEEP_AFTER_MS, maySleep, sleepPose, stepSleep } from '../../src/renderer/office/sleep-cycle';

function snap(partial: Pick<PresenceSnapshot, 'id'> & Partial<PresenceSnapshot>): PresenceSnapshot {
  return {
    zone: 'yard',
    x: 0,
    y: 0,
    facing: 'south',
    moving: false,
    bob: false,
    pose: 'stand',
    monitor: 'off',
    deskIndex: -1,
    mode: 'leisure',
    leisure: null,
    leisureMotion: true,
    quietMs: null,
    ...partial,
  };
}

function advance(board: ErrandBoard, snaps: PresenceSnapshot[], extra: Partial<Parameters<ErrandBoard['advance']>[0]> = {}): void {
  board.advance({
    snaps,
    deltaMs: 16,
    reduced: false,
    now: 0,
    butterflies: [],
    blocked: () => false,
    ...extra,
  });
}

describe('character action strips', () => {
  it('uses the measured frame counts and skips flute', () => {
    expect(CAST_FRAMES.carryIdle).toBe(512 / 32 / 4);
    expect(CAST_FRAMES.carryWalk).toBe(768 / 32 / 4);
    expect(CAST_FRAMES.carryPick).toBe(512 / 32 / 4);
    expect(CAST_FRAMES.net).toBe(768 / 32 / 4);
    expect(CAST_FRAMES.pet).toBe(384 / 32 / 4);
    expect(CAST_FRAMES.sleep).toBe(192 / 32);
    // Folder 22 is 576×32. 18 frames do not split into four facings, so there is no flute row.
    expect(576 / 32).toBe(18);
    expect(18 % 4).not.toBe(0);
    expect(Object.keys(CAST_ROW)).not.toContain('flute');
  });
});

describe('errand stations', () => {
  it('keeps stump, pile, cat, and armchair on distinct walkable cells', () => {
    const keys = Object.values(STATIONS).map(stationKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(NAV.walkable(STATIONS.stump.col, STATIONS.stump.row)).toBe(true);
    expect(NAV.walkable(STATIONS.pile.col, STATIONS.pile.row)).toBe(true);
    expect(NAV.walkable(15, 28)).toBe(false);
    expect(NAV.walkable(17, 28)).toBe(false);
    expect(CABIN_NAV.walkable(STATIONS.pet.col, STATIONS.pet.row)).toBe(true);
    expect(CABIN_NAV.walkable(STATIONS.sleep.col, STATIONS.sleep.row)).toBe(true);
    expect(CABIN_NAV.walkable(19, 16)).toBe(false);
    expect(HEARTH_CHAIR_CELLS.map((cell) => `${cell.col},${cell.row}`)).not.toContain(`${STATIONS.pet.col},${STATIONS.pet.row}`);
    expect(routeTo(stationWaypoint(STATIONS.stump), stationWaypoint(STATIONS.pile)).length).toBeGreaterThan(0);
    expect(routeTo(stationWaypoint(STATIONS.pet), stationWaypoint(STATIONS.sleep)).length).toBeGreaterThan(0);
  });

  it('picks the same consultant every time', () => {
    expect(pickOne(['cursor:b', 'cursor:a'], 'wood')).toBe(pickOne(['cursor:a', 'cursor:b'], 'wood'));
    expect(pickOne([], 'wood')).toBeNull();
  });
});

describe('woodcutter cycle', () => {
  it('chops, lifts, hauls, sets the log down, and returns', () => {
    let state = initialWood();
    expect(woodTravels(state.phase)).toBe(true);
    state = stepWood(state, 50, false, false);
    expect(state.phase).toBe('approach');
    state = stepWood(state, 50, true, false);
    expect(state.phase).toBe('chop');
    expect(woodPose(state, true)?.action).toBe('axe');
    state = stepWood(state, WOOD_CHOP_MS, false, false);
    expect(state.phase).toBe('lift');
    expect(woodPose(state, true)).toMatchObject({ action: 'carryPick', frame: 0 });
    state = stepWood(state, WOOD_LIFT_MS, false, false);
    expect(state.phase).toBe('haul');
    expect(woodPose(state, true)).toMatchObject({ action: 'carryWalk', whileMoving: true });
    state = stepWood(state, 80, false, false);
    expect(state.phase).toBe('haul');
    state = stepWood(state, 80, true, false);
    expect(state.phase).toBe('drop');
    expect(woodPose({ phase: 'drop', phaseMs: 0 }, true)?.frame).toBe(3);
    expect(woodPose({ phase: 'drop', phaseMs: 140 }, true)?.frame).toBe(2);
    expect(woodPose({ phase: 'drop', phaseMs: 0 }, false)?.frame).toBe(3);
    state = stepWood(state, WOOD_DROP_MS, false, false);
    expect(state.phase).toBe('return');
    state = stepWood(state, 40, true, false);
    expect(state.phase).toBe('rest');
    state = stepWood(state, WOOD_REST_MS, false, false);
    expect(state.phase).toBe('approach');
  });

  it('holds the current pose when motion is reduced', () => {
    expect(stepWood({ phase: 'haul', phaseMs: 400 }, 5_000, true, true)).toEqual({ phase: 'haul', phaseMs: 0 });
    expect(woodPose({ phase: 'haul', phaseMs: 0 }, false)?.frame).toBe(0);
  });
});

describe('petting cycle', () => {
  it('walks to the cat, pets, and rests at home', () => {
    let state = initialPet();
    state = stepPet(state, 20, true, false);
    expect(state.phase).toBe('pet');
    expect(petPose(state, true)?.frame).toBe(0);
    state = stepPet(state, PET_MS, false, false);
    expect(state.phase).toBe('back');
    state = stepPet(state, 20, true, false);
    expect(state.phase).toBe('rest');
    state = stepPet(state, PET_REST_MS, false, false);
    expect(state.phase).toBe('go');
  });

  it('holds frame 0 when motion is reduced', () => {
    expect(stepPet({ phase: 'pet', phaseMs: 200 }, 5_000, true, true)).toEqual({ phase: 'pet', phaseMs: 0 });
    expect(petPose({ phase: 'pet', phaseMs: 0 }, false)?.frame).toBe(0);
  });
});

describe('insect cycle', () => {
  it('swings when close, then sends the butterfly away without deleting it', () => {
    let state = initialBug();
    state = stepBug(state, 100, false, false);
    expect(state.phase).toBe('chase');
    state = stepBug(state, 100, true, false);
    expect(state.phase).toBe('swing');
    expect(bugPose(state, true)?.action).toBe('net');
    state = stepBug(state, BUG_SWING_MS, true, false);
    expect(state.phase).toBe('flee');
    const flight = { points: [{ x: 10, y: 10 }], pauseMs: 1, legMs: 1 };
    const away = butterflyAway({ x: 10, y: 10 }, { x: 0, y: 10 }, () => false);
    expect(Math.hypot(away.x - 0, away.y - 10)).toBeGreaterThan(10);
    expect(flight.points).toEqual([{ x: 10, y: 10 }]);
    expect(butterflyAway({ x: 10, y: 10 }, { x: 0, y: 0 }, () => true)).toEqual({ x: 10, y: 10 });
  });

  it('holds the net frame when motion is reduced', () => {
    expect(stepBug({ phase: 'swing', phaseMs: 80 }, 5_000, true, true)).toEqual({ phase: 'swing', phaseMs: 0 });
    expect(bugPose({ phase: 'swing', phaseMs: 0 }, false)?.frame).toBe(0);
    expect(chaseDue('cursor:a', 0)).toBe(chaseDue('cursor:a', 0));
  });
});

describe('sleep cycle', () => {
  it('dozes on the side-lying frames only after a long idle, and before departure', () => {
    expect(maySleep(null, ABSENCE_MS)).toBe(false);
    expect(maySleep(SLEEP_AFTER_MS - 1, ABSENCE_MS)).toBe(false);
    expect(maySleep(SLEEP_AFTER_MS, ABSENCE_MS)).toBe(true);
    expect(maySleep(ABSENCE_MS, ABSENCE_MS)).toBe(false);
    let state = stepSleep({ phase: 'go', phaseMs: 0 }, 30, true, false);
    expect(state.phase).toBe('doze');
    expect(sleepPose(state, false)?.frame).toBe(2);
    state = stepSleep(state, 700, true, false);
    expect(sleepPose(state, true)?.frame).toBe(3);
  });

  it('holds the lying frame when motion is reduced', () => {
    expect(stepSleep({ phase: 'doze', phaseMs: 900 }, 5_000, true, true)).toEqual({ phase: 'doze', phaseMs: 0 });
    expect(sleepPose({ phase: 'doze', phaseMs: 0 }, false)?.frame).toBe(2);
  });
});

describe('errand assignment', () => {
  it('gives each action to one idle consultant and keeps the stations apart', () => {
    const board = new ErrandBoard();
    const woodA = snap({ id: 'cursor:wood-a', leisure: 'woodpile', x: 80, y: 80 });
    const woodB = snap({ id: 'cursor:wood-b', leisure: 'woodpile', x: 120, y: 80 });
    const early = snap({ id: 'cursor:early', zone: 'cabin', leisure: 'hearth', quietMs: 1_000, x: 16, y: 16 });
    const late = snap({ id: 'cursor:late', zone: 'cabin', leisure: 'coffee', quietMs: SLEEP_AFTER_MS, x: 48, y: 16 });
    advance(board, [woodA, woodB, early, late]);
    expect(board.ids().wood).toBe(pickOne([woodA.id, woodB.id], 'wood'));
    expect(board.ids().sleep).toBe(late.id);
    expect(board.ids().pet).toBe(early.id);
    expect(new Set([board.ids().wood, board.ids().pet, board.ids().sleep]).size).toBe(3);
  });

  it('does not send an active or stale consultant, or a fisher, off their spot', () => {
    const board = new ErrandBoard();
    let now = 0;
    while (!chaseDue('cursor:fisher', now) && now < BUG_PERIOD_MS) now += 50;
    advance(board, [
      snap({ id: 'cursor:work', mode: 'work', leisure: 'woodpile', zone: 'cabin' }),
      snap({ id: 'cursor:stale', mode: 'hold' }),
      snap({ id: 'cursor:fisher', leisure: 'fishing', x: 200, y: 200 }),
    ], { now, butterflies: [{ x: 40, y: 40 }] });
    expect(board.ids()).toEqual({ wood: null, pet: null, bug: null, sleep: null });
  });

  it('chases with one garden idle and leaves the butterfly in the list', () => {
    const board = new ErrandBoard();
    const id = 'cursor:gardener';
    let now = 0;
    while (!chaseDue(id, now) && now < BUG_PERIOD_MS) now += 50;
    const butterflies = [{ x: 40, y: 48 }];
    const gardener = snap({ id, leisure: 'garden', x: 40, y: 48 });
    advance(board, [gardener], { now, butterflies });
    expect(board.ids().bug).toBe(id);
    advance(board, [gardener], { now, butterflies, deltaMs: 16 });
    advance(board, [gardener], { now, butterflies, deltaMs: BUG_SWING_MS });
    expect(board.butterflyAt(0)).not.toBeNull();
    expect(butterflies).toEqual([{ x: 40, y: 48 }]);
  });

  it('starts nothing when motion is reduced', () => {
    const board = new ErrandBoard();
    advance(board, [
      snap({ id: 'cursor:wood', leisure: 'woodpile' }),
      snap({ id: 'cursor:sit', zone: 'cabin', leisure: 'hearth', quietMs: SLEEP_AFTER_MS }),
    ], { reduced: true });
    expect(board.ids()).toEqual({ wood: null, pet: null, bug: null, sleep: null });
  });
});
