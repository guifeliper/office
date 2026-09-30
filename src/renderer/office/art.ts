import type { CabinPropKind } from './cabin-layout';
import type { PropKind } from './world-layout';

/** Yard crops are generated into the gitignored cache. See docs/design/tiny-farm/ART-LICENSE.md. */
const yard = (file: string) => new URL(`../../../.cache/tiny-farm/yard/${file}`, import.meta.url).href;

export const PROP_URL: Record<PropKind, { base: string; foreground?: string }> = {
  meetingTable: { base: yard('meeting-table.png') },
  campfire: { base: yard('bonfire-0.png') },
  stumpAxe: { base: yard('stump.png') },
  woodpile: { base: yard('woodpile.png') },
  gardenBed: { base: yard('garden-bed.png') },
  gateLeft: { base: yard('gate-post.png') },
  gateRight: { base: yard('gate-post.png') },
  gatehouse: { base: yard('gatehouse-base.png'), foreground: yard('gatehouse-lintel.png') },
  lodgeDoor: { base: yard('lodge-door.png') },
  fence: { base: yard('fence.png') },
  tree: { base: yard('maple-trunk.png'), foreground: yard('maple-canopy-0.png') },
  rock: { base: yard('rock.png') },
  bush: { base: yard('bush-a.png') },
  shoreRock: { base: yard('shore-rock.png') },
  lodgeRoof: { base: yard('lodge-house.png') },
  bridge: { base: yard('bridge.png') },
  mailbox: { base: yard('mailbox.png') },
  lantern: { base: yard('lantern.png') },
  flower: { base: yard('flower.png') },
  bloom: { base: yard('bloom.png') },
  mushroom: { base: yard('mushroom.png') },
  banana: { base: yard('banana.png') },
  cherry: { base: yard('cherry.png') },
  fruitTree: { base: yard('fruit-tree.png') },
  lily: { base: yard('lily.png') },
  doghouse: { base: yard('doghouse.png') },
  laundry: { base: yard('laundry.png') },
  hay: { base: yard('hay.png') },
  crate: { base: yard('crate.png') },
  butterfly: { base: yard('butterfly.png') },
  greenhouse: { base: yard('greenhouse.png') },
  canoe: { base: yard('canoe.png') },
  pier: { base: yard('pier.png') },
  sandcastle: { base: yard('sandcastle.png') },
  waterfall: { base: yard('waterfall.png') },
  fishman: { base: yard('fishman.png') },
};

/** Three maple crowns from Maple Tree.png, row y=49. */
export const CANOPY_VARIANTS = [
  yard('maple-canopy-0.png'),
  yard('maple-canopy-1.png'),
  yard('maple-canopy-2.png'),
] as const;

export const BUSH_VARIANTS = [yard('bush-a.png'), yard('bush-b.png')] as const;

/** Cabana Norte: Tiny Farm crops only, cut by `scripts/cut-cabin.ts` into the cache. */
const cabin = (file: string) => new URL(`../../../.cache/tiny-farm/cabin/${file}`, import.meta.url).href;

export const CABIN_PROP_URL: Record<CabinPropKind, string> = {
  desk: cabin('desk.png'),
  computer: cabin('computer.png'),
  chair: cabin('chair-north.png'),
  fireplace: cabin('fireplace.png'),
  bookshelf: cabin('bookshelf.png'),
  plant: cabin('plant.png'),
  counter: cabin('counter.png'),
  kettle: cabin('kettle.png'),
  mug: cabin('mug.png'),
  armchair: cabin('armchair.png'),
  cat: cabin('cat.png'),
  door: cabin('door.png'),
};

export const CABIN_FLOOR_URL = cabin('floor.png');
export const CABIN_WALL_URLS = [cabin('wall-window.png'), cabin('wall-plain.png')] as const;
export const CABIN_FLAME_URLS = [0, 1, 2, 3].map((i) => cabin(`flame-${i}.png`));

/** Six frames from the pack bonfire strip. */
export const CAMPFIRE_FRAME_URL = [0, 1, 2, 3, 4, 5].map((i) => yard(`bonfire-${i}.png`));
