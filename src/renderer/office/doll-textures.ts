import { Assets, Rectangle, Texture } from 'pixi.js';
import type { CharacterSheets } from './consultant-view';
import type { Facing } from './landmarks';
import { LEISURE_KINDS } from './leisure';
import { LEISURE_ACTION, LOOK_URLS, CAST_FRAMES, castFrameRect, lookIndexFor, type CastAction } from './tiny-farm-cast';

const FACINGS: readonly Facing[] = ['south', 'north', 'east', 'west'];

/**
 * Slices the Tiny Farm look strips into per-facing frames. Every look is loaded once;
 * a seed maps to a look by hash, so the same conversation keeps the same body.
 */
export class DollLibrary {
  private looks: CharacterSheets[] = [];

  async load(): Promise<void> {
    const sheets = await Promise.all(LOOK_URLS.map((url) => Assets.load<Texture>(url)));
    this.looks = sheets.map((sheet) => {
      sheet.source.scaleMode = 'nearest';
      sheet.source.autoGenerateMipmaps = false;
      return slice(sheet);
    });
  }

  /** Kept for the scene contract; every look is resident, so there is nothing to claim. */
  claimHolders(_holders: readonly { id: string; seed: string }[]): void {}

  sheetsFor(seed: string): CharacterSheets | null {
    return this.looks[lookIndexFor(seed)] ?? null;
  }

  pump(): boolean {
    return false;
  }

  destroy(): void {
    for (const look of this.looks) {
      for (const texture of allTextures(look)) texture.destroy(false);
    }
    this.looks = [];
  }
}

function slice(sheet: Texture): CharacterSheets {
  const frames = (action: CastAction, facing: Facing): Texture[] =>
    Array.from({ length: CAST_FRAMES[action] }, (_, i) => {
      const r = castFrameRect(action, facing, i);
      return new Texture({ source: sheet.source, frame: new Rectangle(r.x, r.y, r.w, r.h) });
    });
  const byFacing = <T>(make: (facing: Facing) => T): Record<Facing, T> =>
    Object.fromEntries(FACINGS.map((facing) => [facing, make(facing)])) as Record<Facing, T>;
  return {
    idle: byFacing((facing) => frames('idle', facing)),
    walk: byFacing((facing) => frames('walk', facing)),
    sit: byFacing((facing) => frames('sit', facing)[0]!),
    water: byFacing((facing) => frames('water', facing)),
    fishing: byFacing((facing) => ({
      cast: frames('fishCast', facing),
      wait: frames('fishWait', facing),
      bite: frames('fishBite', facing),
      reel: frames('fishReel', facing),
      catch: frames('fishCatch', facing),
    })),
    carryIdle: byFacing((facing) => frames('carryIdle', facing)),
    carryWalk: byFacing((facing) => frames('carryWalk', facing)),
    carryPick: byFacing((facing) => frames('carryPick', facing)),
    net: byFacing((facing) => frames('net', facing)),
    pet: byFacing((facing) => frames('pet', facing)),
    sleep: frames('sleep', 'south'),
    leisure: Object.fromEntries(
      LEISURE_KINDS.filter((kind) => kind !== 'fishing').map((kind) => [kind, byFacing((facing) => frames(LEISURE_ACTION[kind], facing))]),
    ) as CharacterSheets['leisure'],
  };
}

function allTextures(look: CharacterSheets): Texture[] {
  return [
    ...Object.values(look.idle).flat(),
    ...Object.values(look.walk).flat(),
    ...Object.values(look.sit),
    ...Object.values(look.water).flat(),
    ...Object.values(look.fishing).flatMap((phases) => Object.values(phases).flat()),
    ...Object.values(look.leisure).flatMap((byFacing) => Object.values(byFacing).flat()),
    ...Object.values(look.carryIdle).flat(),
    ...Object.values(look.carryWalk).flat(),
    ...Object.values(look.carryPick).flat(),
    ...Object.values(look.net).flat(),
    ...Object.values(look.pet).flat(),
    ...look.sleep,
  ];
}
