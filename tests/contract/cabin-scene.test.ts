import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { START_SCENE, nextScene, portalAt } from '../../src/renderer/office/scene-state';
import {
  CABIN_DESKS,
  CABIN_PROPS,
  CAST_CELL,
  CAST_FEET_ROW,
  SEAT_DROP,
  cabinDoorRect,
  chairAnchor,
  deskSeat,
  seatCell,
} from '../../src/renderer/office/cabin-layout';
import { lodgeRect } from '../../src/renderer/office/world-layout';
import { DESKS } from '../../src/renderer/office/landmarks';
import { FOOT_ANCHOR_Y } from '../../src/renderer/office/consultant-view';
import { CAST_ROW, castFrameRect, LOOK_COUNT } from '../../src/renderer/office/tiny-farm-cast';
import { readPng, stats, createImage, type Rgba } from '../../scripts/png';

const ROOT = path.resolve(__dirname, '../..');
const ART = path.join(ROOT, '.cache/tiny-farm');

function crop(img: Rgba, r: { x: number; y: number; w: number; h: number }): Rgba {
  const out = createImage(r.w, r.h);
  for (let y = 0; y < r.h; y += 1) {
    const from = ((r.y + y) * img.width + r.x) * 4;
    out.data.set(img.data.subarray(from, from + r.w * 4), y * r.w * 4);
  }
  return out;
}

const center = (rect: { x: number; y: number; w: number; h: number }) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

describe('scene switching', () => {
  it('starts inside the cabin', () => {
    expect(START_SCENE).toBe('cabin');
  });

  it('enters from the lodge outside and leaves by the cabin door or Escape', () => {
    const lodge = center(lodgeRect());
    const door = center(cabinDoorRect());
    expect(portalAt('yard', lodge.x, lodge.y)).toBe(true);
    expect(nextScene('yard', { kind: 'click', ...lodge })).toBe('cabin');
    expect(nextScene('yard', { kind: 'click', x: 8, y: 8 })).toBe('yard');
    expect(nextScene('cabin', { kind: 'click', ...door })).toBe('yard');
    expect(nextScene('cabin', { kind: 'click', x: 40, y: 150 })).toBe('cabin');
    expect(nextScene('cabin', { kind: 'escape' })).toBe('yard');
    expect(nextScene('yard', { kind: 'escape' })).toBe('yard');
  });
});

describe('cabin workstations', () => {
  it('keeps 16 desks in two rows of eight, each with one computer and one chair', () => {
    expect(CABIN_DESKS).toHaveLength(16);
    expect(DESKS).toHaveLength(16);
    expect(CABIN_PROPS.filter((p) => p.kind === 'computer')).toHaveLength(16);
    const rows = [...new Set(CABIN_DESKS.map((d) => d.row))];
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(CABIN_DESKS.filter((d) => d.row === row)).toHaveLength(8);
    for (const desk of CABIN_DESKS) {
      const seat = seatCell(desk);
      expect(CABIN_PROPS.some((p) => p.kind === 'chair' && p.col === seat.col && p.row === seat.row)).toBe(true);
    }
  });
});

describe('Tiny Farm sit anchor', () => {
  const look = readPng(path.join(ART, 'cast/look-00.png'));
  const chair = readPng(path.join(ART, 'cabin/chair-north.png'));

  it('anchors standing feet on the pack feet row (y 25 in the 32 px cell)', () => {
    for (const action of ['idle', 'walk'] as const) {
      const box = stats(crop(look, castFrameRect(action, 'south', 0))).opaqueBox!;
      expect(box.y + box.h).toBe(CAST_FEET_ROW);
    }
    expect(FOOT_ANCHOR_Y).toBe(CAST_FEET_ROW / CAST_CELL);
  });

  it('seats the north sit frame on the chair: same bottom line, origin 8 px left of the chair', () => {
    const sit = stats(crop(look, castFrameRect('sit', 'north', 0))).opaqueBox!;
    // Hip ends inside the seat band the pack chair draws (y 21–25).
    expect(sit.y + sit.h - 1).toBeGreaterThanOrEqual(21);
    expect(sit.y + sit.h - 1).toBeLessThanOrEqual(25);
    expect(chair.width).toBe(16);
    expect(chair.height).toBe(32);

    const desk = CABIN_DESKS[0]!;
    const seat = deskSeat(desk);
    const chairPlacement = { kind: 'chair' as const, ...seatCell(desk) };
    const base = chairAnchor(chairPlacement);
    const bodyOrigin = { x: seat.x - CAST_CELL / 2, y: seat.y - CAST_CELL * FOOT_ANCHOR_Y };
    const chairOrigin = { x: base.x - chair.width / 2, y: base.y - chair.height };
    expect(bodyOrigin.x - chairOrigin.x).toBe(-8);
    expect(bodyOrigin.y + CAST_CELL).toBe(chairOrigin.y + chair.height);
    expect(SEAT_DROP).toBe(CAST_CELL - CAST_FEET_ROW);
  });

  it('ships 16 composed looks, including carrying, the net, petting, and sleep', () => {
    for (let i = 0; i < LOOK_COUNT; i += 1) {
      const img = readPng(path.join(ART, `cast/look-${String(i).padStart(2, '0')}.png`));
      const rows = Math.max(...Object.values(CAST_ROW)) + 1;
      expect([img.width, img.height]).toEqual([1920, rows * CAST_CELL]);
      expect(stats(img).alphaClean).toBe(true);
    }
  });
});

describe('Tiny Farm only in the cabin runtime', () => {
  it('references no handmade prop, monitor, or painted cast from the scene', () => {
    const scene = fs.readFileSync(path.join(ROOT, 'src/renderer/office/scene.ts'), 'utf8');
    const art = fs.readFileSync(path.join(ROOT, 'src/renderer/office/art.ts'), 'utf8');
    const dolls = fs.readFileSync(path.join(ROOT, 'src/renderer/office/doll-textures.ts'), 'utf8');
    expect(scene).not.toMatch(/MONITOR/);
    expect(art).not.toMatch(/prop\('(desk|chair|monitor)\.png'\)/);
    expect(dolls).not.toMatch(/from '\.\/cast'|paper-doll/);
  });
});

describe('Tiny Farm only in the courtyard runtime', () => {
  it('imports no handmade yard prop, water, or lodge paint', () => {
    const art = fs.readFileSync(path.join(ROOT, 'src/renderer/office/art.ts'), 'utf8');
    const ground = fs.readFileSync(path.join(ROOT, 'src/renderer/office/ground-tiles.ts'), 'utf8');
    const props = [...art.matchAll(/prop\('([^']+)'\)/g)].map((match) => match[1]!);
    expect(props).toEqual([]);
    expect(art).toContain('maple-trunk.png');
    expect(art).toContain('maple-canopy-0.png');
    expect(art).toContain('.cache/tiny-farm/yard/');
    expect(ground).not.toMatch(/RAMP\.water|new Tile\(/);
    expect(art).toContain('lodge-house.png');
    const house = readPng(path.join(ART, 'yard/lodge-house.png'));
    expect([house.width, house.height]).toEqual([72, 95]);
    for (const file of ['fence.png', 'bridge.png', 'mailbox.png', 'lantern.png', 'lodge-door.png', 'lodge-roof.png', 'lodge-house.png', 'bonfire-0.png', 'bonfire-5.png', 'water.png']) {
      expect(fs.existsSync(path.join(ART, 'yard', file)), file).toBe(true);
    }
  });
});

describe('domain boundary', () => {
  it('keeps the scene and cabin modules out of the domain reducer', () => {
    const dir = path.join(ROOT, 'src/domain');
    for (const file of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(text).not.toMatch(/renderer|cabin|scene-state/);
    }
    for (const file of ['scene-state.ts', 'cabin-layout.ts', 'landmarks.ts', 'presence.ts']) {
      const text = fs.readFileSync(path.join(ROOT, 'src/renderer/office', file), 'utf8');
      const imports = [...text.matchAll(/^import (type )?.*from '([^']+)'/gm)];
      for (const [, typeOnly, from] of imports) {
        if (from!.includes('domain')) expect(typeOnly).toBe('type ');
      }
    }
  });
});
