import { describe, expect, it } from 'vitest';
import {
  FOREGROUND_DEPTH,
  GROUND_DEPTH,
  canopyDepth,
  depthFromFeet,
  drawsInFront,
  foregroundDepth,
} from '../../src/renderer/office/depth';
import {
  PROPS,
  PROP_SPECS,
  ROWS,
  TILE,
  TRUNK_HEIGHT,
  canopyLineY,
  propBase,
} from '../../src/renderer/office/world-layout';
import { CABIN_DESKS, CABIN_PROPS, cabinSpriteAnchor, deskSeat, seatCell } from '../../src/renderer/office/cabin-layout';

describe('feet depth sort', () => {
  it('draws the lower agent in front using feet, not center or top', () => {
    const consultantFeet = 310;
    const neighborFeet = 300;
    // Same canvas, different anchors: the shorter neighbor's center sits lower
    // on screen than the consultant's center. Feet order must not follow that.
    const consultantCenter = consultantFeet - 22;
    const neighborCenter = neighborFeet - 8;
    const consultantTop = consultantFeet - 56;

    expect(neighborCenter).toBeGreaterThan(consultantCenter);
    expect(depthFromFeet(consultantFeet)).toBe(consultantFeet);
    expect(depthFromFeet(consultantFeet)).not.toBe(consultantCenter);
    expect(depthFromFeet(consultantFeet)).not.toBe(consultantTop);
    expect(drawsInFront(consultantFeet, neighborFeet)).toBe(true);
    expect(drawsInFront(neighborFeet, consultantFeet)).toBe(false);

    const views = [
      { id: 'north', feetY: neighborFeet },
      { id: 'south', feetY: consultantFeet },
    ].sort((a, b) => depthFromFeet(a.feetY) - depthFromFeet(b.feetY));
    expect(views.map((view) => view.id)).toEqual(['north', 'south']);
  });

  it('sorts a trunk by its base and the canopy by the canopy bottom line', () => {
    const tree = PROPS.find((p) => p.kind === 'tree')!;
    expect(PROP_SPECS.tree.foreground).toBe('canopy');
    const base = propBase(tree);
    expect(depthFromFeet(base.y)).toBe(base.y);
    expect(drawsInFront(base.y + 8, base.y)).toBe(true);
    expect(drawsInFront(base.y - 8, base.y)).toBe(false);

    const line = canopyLineY(tree);
    expect(line).toBe(base.y - TRUNK_HEIGHT - 1);
    const leaves = canopyDepth(line);
    expect(leaves).toBeLessThan(FOREGROUND_DEPTH);

    // One tile south of the canopy line: the walker draws over the leaves (head free).
    expect(depthFromFeet(line + TILE)).toBeGreaterThan(leaves);
    // One tile north, or feet exactly on the line: the leaves cover the walker.
    expect(depthFromFeet(line - TILE)).toBeLessThan(leaves);
    expect(depthFromFeet(line)).toBeLessThan(leaves);
    // Canopy against canopy: the one further south draws in front.
    expect(canopyDepth(line + TILE)).toBeGreaterThan(leaves);
    expect(depthFromFeet(0)).toBeGreaterThan(GROUND_DEPTH);
  });

  it('draws a seated consultant behind the chair back and in front of the desk', () => {
    const desk = CABIN_DESKS[0]!;
    const seat = seatCell(desk);
    const chair = CABIN_PROPS.find((p) => p.kind === 'chair' && p.col === seat.col && p.row === seat.row)!;
    const sitterZ = depthFromFeet(deskSeat(desk).y);
    const deskZ = cabinSpriteAnchor(desk).z;
    const computerZ = cabinSpriteAnchor({ kind: 'computer', col: desk.col, row: desk.row }).z;
    const chairZ = cabinSpriteAnchor(chair).z;
    expect(computerZ).toBeGreaterThan(deskZ);
    expect(sitterZ).toBeGreaterThan(computerZ);
    expect(chairZ).toBeGreaterThan(sitterZ);
  });

  it('keeps overhead pieces (gate lintel) above every walker, and only those', () => {
    const lowestFeet = depthFromFeet(ROWS * TILE);
    expect(FOREGROUND_DEPTH).toBeGreaterThan(lowestFeet);
    const overhead = PROPS.filter((p) => PROP_SPECS[p.kind].foreground === 'overhead');
    expect(overhead).toEqual([]);
    expect(foregroundDepth(0)).toBeGreaterThan(lowestFeet);
    for (const placement of overhead) {
      const { y } = propBase(placement);
      expect(foregroundDepth(y)).toBeGreaterThan(lowestFeet);
    }
    for (const placement of PROPS.filter((p) => PROP_SPECS[p.kind].foreground === 'canopy')) {
      expect(canopyDepth(canopyLineY(placement))).toBeLessThan(lowestFeet);
    }
  });
});
