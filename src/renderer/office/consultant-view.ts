import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { hslToHex } from './assets';
import type { Facing } from './landmarks';
import type { ProvenanceBadge } from './projection';
import type { PresenceSnapshot } from './presence';
import type { FishPhase } from './fish-cycle';
import { leisureFrameIndex, type LeisureKind } from './leisure';
import { depthFromFeet } from './depth';
import { CAST_CELL, CAST_FEET_ROW } from './cabin-layout';

/** Tiny Farm feet end on row 25 of the 32 px cell. Anchor on the line under them. */
export const FOOT_ANCHOR_Y = CAST_FEET_ROW / CAST_CELL;
export const WALK_FRAME_MS = 110;
const IDLE_FRAME_MS = 320;

/** Provenance dot above the head. The pack head top is row 6, 20 px above the feet line. */
const BADGE_Y = -(CAST_FEET_ROW - 6) - 5;

const BADGE_COLOR: Record<ProvenanceBadge, number> = {
  observed: 0x2f6f8f,
  inferred: 0xb0892c,
  ambient: 0x5a6675,
  stale: 0x8b5a2b,
};

/** One look, sliced from a Tiny Farm strip. Every frame is a pack frame. */
export interface CharacterSheets {
  idle: Record<Facing, Texture[]>;
  walk: Record<Facing, Texture[]>;
  sit: Record<Facing, Texture>;
  water: Record<Facing, Texture[]>;
  fishing: Record<Facing, Record<FishPhase, Texture[]>>;
  carryIdle: Record<Facing, Texture[]>;
  carryWalk: Record<Facing, Texture[]>;
  carryPick: Record<Facing, Texture[]>;
  net: Record<Facing, Texture[]>;
  pet: Record<Facing, Texture[]>;
  /** Six frames in a line. Not four facings. */
  sleep: Texture[];
  leisure: Record<Exclude<LeisureKind, 'fishing'>, Record<Facing, Texture[]>>;
}

export type ErrandAction = 'axe' | 'carryPick' | 'carryWalk' | 'net' | 'pet' | 'sleep';

/** One pack frame for a renderer errand. `at` draws the body on a prop (the armchair). */
export interface ErrandPose {
  action: ErrandAction;
  frame: number;
  whileMoving: boolean;
  at?: { x: number; y: number };
}

export interface GardenPose {
  action: 'hoe' | 'sit' | 'water' | 'idle';
  play: boolean;
}

export interface FishPose {
  phase: FishPhase;
  frame: number;
  play: boolean;
}

export interface SpriteChrome {
  badge: ProvenanceBadge;
  /** Set on a collaborator. A small pip in the parent's hue; no line back to them. */
  parentHue?: number | null;
}

export class ConsultantSprite {
  readonly root = new Container();
  private readonly body: Sprite;
  private readonly badge = new Graphics();
  private walkIndex = 0;
  private walkMs = 0;
  private idleMs = 0;
  private leisureMs = 0;

  constructor(
    private readonly sheets: CharacterSheets,
    model: SpriteChrome,
    scale = 1,
  ) {
    this.body = new Sprite(sheets.idle.south[0]);
    this.body.anchor.set(0.5, FOOT_ANCHOR_Y);
    this.body.scale.set(scale);
    this.body.roundPixels = true;
    this.root.addChild(this.body);
    this.root.addChild(this.badge);
    this.root.eventMode = 'none';
    this.layoutChrome(model);
  }

  draw(
    model: SpriteChrome,
    snap: PresenceSnapshot,
    deltaMs: number,
    garden?: GardenPose | null,
    fish?: FishPose | null,
    errand?: ErrandPose | null,
  ): void {
    const x = errand?.at?.x ?? snap.x;
    const y = errand?.at?.y ?? snap.y;
    this.root.position.set(Math.round(x), Math.round(y));
    this.root.zIndex = depthFromFeet(y);
    this.body.texture = this.frameFor(snap, deltaMs, garden, fish, errand);
    this.layoutChrome(model);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private frameFor(
    snap: PresenceSnapshot,
    deltaMs: number,
    garden?: GardenPose | null,
    fish?: FishPose | null,
    errand?: ErrandPose | null,
  ): Texture {
    if (errand && (errand.whileMoving || !snap.moving)) return this.errandFrame(snap, errand);
    if (snap.leisure === 'fishing') {
      if (snap.moving || !fish) return this.walkOrIdle(snap, deltaMs, snap.moving);
      return this.fishFrame(snap, fish);
    }
    if (snap.leisure === 'garden' && garden) return this.gardenFrame(snap, deltaMs, garden);
    if (snap.leisure) {
      const frames = this.sheets.leisure[snap.leisure][snap.facing];
      if (!snap.leisureMotion || frames.length <= 1) {
        this.leisureMs = 0;
        return frames[0]!;
      }
      this.leisureMs += deltaMs;
      return frames[leisureFrameIndex(snap.leisure, this.leisureMs, true)] ?? frames[0]!;
    }
    if (snap.pose === 'sit') return this.sheets.sit[snap.facing];
    return this.walkOrIdle(snap, deltaMs, false);
  }

  private walkOrIdle(snap: PresenceSnapshot, deltaMs: number, walking: boolean): Texture {
    if (!walking && !snap.moving) {
      const frames = this.sheets.idle[snap.facing];
      // Stale and reduced motion hold frame 0; the pack idle breathes otherwise.
      if (snap.mode === 'hold' || !snap.bob) {
        this.idleMs = 0;
        return frames[0]!;
      }
      this.idleMs += deltaMs;
      return frames[Math.floor(this.idleMs / IDLE_FRAME_MS) % frames.length]!;
    }
    this.walkMs += deltaMs;
    if (this.walkMs >= WALK_FRAME_MS) {
      this.walkMs = 0;
      this.walkIndex = (this.walkIndex + 1) % 6;
    }
    const frames = this.sheets.walk[snap.facing];
    return frames[this.walkIndex] ?? frames[0]!;
  }

  private errandFrame(snap: PresenceSnapshot, errand: ErrandPose): Texture {
    if (errand.action === 'sleep') return this.sheets.sleep[errand.frame] ?? this.sheets.sleep[0]!;
    const bank = errand.action === 'axe'
      ? this.sheets.leisure.woodpile
      : errand.action === 'carryPick'
        ? this.sheets.carryPick
        : errand.action === 'carryWalk'
          ? this.sheets.carryWalk
          : errand.action === 'net'
            ? this.sheets.net
            : this.sheets.pet;
    const frames = bank[snap.facing];
    return frames[errand.frame] ?? frames[0]!;
  }

  private fishFrame(snap: PresenceSnapshot, fish: FishPose): Texture {
    const frames = this.sheets.fishing[snap.facing][fish.phase];
    const index = fish.play ? fish.frame : 0;
    return frames[index] ?? frames[0]!;
  }

  private gardenFrame(snap: PresenceSnapshot, deltaMs: number, garden: GardenPose): Texture {
    const facing = snap.facing;
    if (garden.action === 'sit') return this.sheets.sit[facing];
    const frames = garden.action === 'water'
      ? this.sheets.water[facing]
      : garden.action === 'hoe'
        ? this.sheets.leisure.garden[facing]
        : this.sheets.idle[facing];
    if (!garden.play || frames.length <= 1) return frames[0]!;
    this.leisureMs += deltaMs;
    const step = garden.action === 'water' ? 140 : garden.action === 'hoe' ? 160 : 320;
    return frames[Math.floor(this.leisureMs / step) % frames.length] ?? frames[0]!;
  }

  /** Provenance stays a dot above the head. The name lives in the HTML roster. */
  private layoutChrome(model: SpriteChrome): void {
    drawBadge(this.badge, model.badge, 0, BADGE_Y);
    if (model.parentHue == null) return;
    this.badge.circle(6, BADGE_Y, 2);
    this.badge.fill({ color: hslToHex(model.parentHue, 0.45, 0.42) });
  }
}

function drawBadge(g: Graphics, badge: ProvenanceBadge, x: number, y: number): void {
  const color = BADGE_COLOR[badge];
  g.clear();
  if (badge === 'inferred') {
    g.poly([x, y - 3, x + 3, y, x, y + 3, x - 3, y]);
    g.fill({ color });
    return;
  }
  if (badge === 'ambient') {
    g.circle(x, y, 2.5);
    g.stroke({ width: 1, color });
    return;
  }
  if (badge === 'stale') {
    g.rect(x - 2, y - 2, 4, 4);
    g.fill({ color });
    return;
  }
  g.circle(x, y, 2.5);
  g.fill({ color });
}
