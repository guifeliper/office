import 'pixi.js/unsafe-eval';
import { Application, Assets, Container, Sprite, Text, type Texture } from 'pixi.js';
import {
  BUSH_VARIANTS,
  CABIN_FLAME_URLS,
  CABIN_FLOOR_URL,
  CABIN_PROP_URL,
  CABIN_WALL_URLS,
  CAMPFIRE_FRAME_URL,
  CANOPY_VARIANTS,
  PROP_URL,
} from './art';
import { DollLibrary } from './doll-textures';
import { MapCamera } from './camera';
import { createGround } from './ground';
import { createPropSprites, type PropTextures } from './prop-view';
import { GROUND_DEPTH } from './depth';
import { PROPS, type PropKind } from './world-layout';
import {
  CABIN_COLS,
  CABIN_PROPS,
  CABIN_ROWS,
  CABIN_WORLD,
  WALL_ROWS,
  cabinSpriteAnchor,
  flameAnchor,
  type CabinPropKind,
} from './cabin-layout';
import { ConsultantSprite } from './consultant-view';
import { COLLABORATOR_SCALE, type OfficeViewModel } from './projection';
import { WORLD } from './landmarks';
import { PresenceDirector, type PresenceSnapshot } from './presence';
import { START_SCENE, nextScene, portalAt, type SceneId } from './scene-state';

const TILE = 16;
const FLAME_MS = 150;
/** Clear color around the world: the yard keeps its cream margin, the cabin sits in the dark. */
const BACKDROP: Record<SceneId, number> = { yard: 0xfff8f1, cabin: 0x1c0a18 };
const CLICK_SLOP = 4;

interface SceneLayer {
  world: Container;
  actors: Container;
  camera: MapCamera;
  size: { width: number; height: number };
  fitted: boolean;
}

export class OfficeScene {
  private app: Application | null = null;
  private readonly layers: Record<SceneId, SceneLayer> = {
    cabin: makeLayer(CABIN_WORLD),
    yard: makeLayer(WORLD),
  };
  private active: SceneId = START_SCENE;
  private readonly waitingLabel = new Text({
    text: 'Waiting for Cursor activity',
    style: {
      fontFamily: 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif',
      fontSize: 18,
      fill: 0x5a6675,
    },
  });
  private readonly presence = new PresenceDirector();
  private consultants = new Map<string, ConsultantSprite>();
  private collaborators = new Map<string, ConsultantSprite>();
  private readonly dolls = new DollLibrary();
  private dollsReady = false;
  private campfireFrames: Texture[] = [];
  private campfireSprites: Sprite[] = [];
  private campfireMs = 0;
  private flameFrames: Texture[] = [];
  private flameSprites: Sprite[] = [];
  private flameMs = 0;
  private view: OfficeViewModel | null = null;
  private reducedMotion = false;
  private destroyed = false;
  private inputAbort: AbortController | null = null;
  private host: HTMLElement | null = null;

  get scene(): SceneId {
    return this.active;
  }

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: BACKDROP[this.active],
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }

    this.host = host;
    this.app = app;
    host.appendChild(app.canvas);
    this.waitingLabel.anchor.set(0.5);
    this.waitingLabel.eventMode = 'none';
    this.layers.yard.world.addChild(createGround());
    app.stage.addChild(this.layers[this.active].world);
    app.stage.addChild(this.waitingLabel);
    app.stage.eventMode = 'none';

    this.bindInput(host);
    this.layoutLabel();

    try {
      Assets.setPreferences({ preferWorkers: false, preferCreateImageBitmap: false });
      const [propTextures, canopies, bushes] = await Promise.all([
        loadProps(),
        Promise.all(CANOPY_VARIANTS.map((url) => loadNearest(url))),
        Promise.all(BUSH_VARIANTS.map((url) => loadNearest(url))),
        this.dolls.load(),
        this.buildCabin(),
      ]);
      this.dollsReady = true;
      if (this.destroyed) return;
      const props = createPropSprites(PROPS, propTextures, { canopies, bushes });
      for (const sprite of props) this.layers.yard.actors.addChild(sprite);
      this.campfireSprites = props.filter((sprite) => sprite.label === 'campfire');
      this.campfireFrames = await Promise.all(CAMPFIRE_FRAME_URL.map((url) => loadNearest(url)));
    } catch (error) {
      console.error('Office art failed to load', error);
    }

    if (this.destroyed) return;
    if (this.view) this.syncActors();
    this.fit();
    app.ticker.add((ticker) => {
      this.tick(ticker.deltaMS);
    });
  }

  setView(view: OfficeViewModel): void {
    this.view = view;
    this.presence.sync([
      ...view.consultants.map((consultant) => ({
        id: consultant.id,
        workState: consultant.workState,
        ambientEligible: consultant.ambientEligible,
      })),
      ...view.collaborators.map((collaborator) => ({
        id: collaborator.id,
        workState: collaborator.workState,
        ambientEligible: false,
      })),
    ]);
    this.waitingLabel.visible = view.waitingForActivity;
    if (this.dollsReady) this.syncActors();
  }

  resize(width: number, height: number): void {
    this.waitingLabel.position.set(width / 2, height / 2);
  }

  /** Frame the scene on screen. Does not change consultant presence. */
  fit(): void {
    if (!this.app) return;
    const layer = this.layers[this.active];
    layer.camera.fit(this.app.screen.width, this.app.screen.height, layer.size.width, layer.size.height);
    layer.fitted = true;
    this.applyCamera();
  }

  /** Swap the stage to another scene. Presence, desks, and monitor phase keep running. */
  showScene(next: SceneId): void {
    if (next === this.active || !this.app) return;
    this.app.stage.removeChild(this.layers[this.active].world);
    this.active = next;
    this.app.stage.addChildAt(this.layers[next].world, 0);
    this.app.renderer.background.color = BACKDROP[next];
    if (!this.layers[next].fitted) this.fit();
    else this.applyCamera();
    if (this.host) this.host.dataset.scene = next;
  }

  destroy(): void {
    this.destroyed = true;
    this.inputAbort?.abort();
    this.inputAbort = null;
    for (const sprite of this.consultants.values()) sprite.destroy();
    for (const sprite of this.collaborators.values()) sprite.destroy();
    this.consultants.clear();
    this.collaborators.clear();
    this.dolls.destroy();
    const offStage = this.active === 'cabin' ? this.layers.yard.world : this.layers.cabin.world;
    offStage.destroy({ children: true });
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.host = null;
  }

  private async buildCabin(): Promise<void> {
    const layer = this.layers.cabin;
    const [floor, walls, flames, props] = await Promise.all([
      loadNearest(CABIN_FLOOR_URL),
      Promise.all(CABIN_WALL_URLS.map((url) => loadNearest(url))),
      Promise.all(CABIN_FLAME_URLS.map((url) => loadNearest(url))),
      Promise.all((Object.keys(CABIN_PROP_URL) as CabinPropKind[]).map(async (kind) => [kind, await loadNearest(CABIN_PROP_URL[kind])] as const)),
    ]);
    const textures = Object.fromEntries(props) as Record<CabinPropKind, Texture>;

    const ground = new Container();
    ground.zIndex = GROUND_DEPTH;
    for (let r = WALL_ROWS; r < CABIN_ROWS; r += 1) {
      for (let c = 0; c < CABIN_COLS; c += 1) ground.addChild(staticSprite(floor, c * TILE, r * TILE));
    }
    for (let i = 0; i * 64 < CABIN_COLS * TILE; i += 1) {
      ground.addChild(staticSprite(walls[i % 2 === 0 ? 1 : 0]!, i * 64, 0));
    }
    layer.world.addChild(ground);

    for (const placement of CABIN_PROPS) {
      const anchor = cabinSpriteAnchor(placement);
      const sprite = anchored(textures[placement.kind], anchor);
      sprite.label = placement.kind;
      layer.actors.addChild(sprite);
      if (placement.kind === 'fireplace') {
        const flame = anchored(flames[0]!, flameAnchor(placement));
        this.flameSprites.push(flame);
        layer.actors.addChild(flame);
      }
    }
    this.flameFrames = flames;
  }

  private layoutLabel(): void {
    if (!this.app) return;
    this.waitingLabel.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
  }

  private applyCamera(): void {
    const { world, camera } = this.layers[this.active];
    world.scale.set(camera.scale);
    world.position.set(camera.x, camera.y);
  }

  private toWorld(host: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
    const rect = host.getBoundingClientRect();
    const { camera } = this.layers[this.active];
    return { x: (clientX - rect.left - camera.x) / camera.scale, y: (clientY - rect.top - camera.y) / camera.scale };
  }

  private bindInput(host: HTMLElement): void {
    const ac = new AbortController();
    this.inputAbort = ac;
    const { signal } = ac;
    host.dataset.scene = this.active;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = motion.matches;
    motion.addEventListener('change', (event) => {
      this.reducedMotion = event.matches;
    }, { signal });
    let dragging = false;
    let travel = 0;
    let lastX = 0;
    let lastY = 0;

    host.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return;
        dragging = true;
        travel = 0;
        lastX = event.clientX;
        lastY = event.clientY;
        host.setPointerCapture(event.pointerId);
      },
      { signal },
    );
    host.addEventListener(
      'pointermove',
      (event) => {
        if (!dragging) {
          const p = this.toWorld(host, event.clientX, event.clientY);
          host.style.cursor = portalAt(this.active, p.x, p.y) ? 'pointer' : '';
          return;
        }
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        travel += Math.abs(dx) + Math.abs(dy);
        if (travel > CLICK_SLOP) host.classList.add('is-panning');
        this.layers[this.active].camera.pan(dx, dy);
        this.applyCamera();
      },
      { signal },
    );
    host.addEventListener(
      'pointerup',
      (event) => {
        const wasClick = dragging && travel <= CLICK_SLOP;
        dragging = false;
        host.classList.remove('is-panning');
        if (!wasClick) return;
        const p = this.toWorld(host, event.clientX, event.clientY);
        this.showScene(nextScene(this.active, { kind: 'click', x: p.x, y: p.y }));
      },
      { signal },
    );
    host.addEventListener('pointercancel', () => {
      dragging = false;
      host.classList.remove('is-panning');
    }, { signal });
    // Trackpads send many small deltas; one integer step per WHEEL_STEP of travel.
    let wheel = 0;
    host.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        wheel += event.deltaY;
        if (Math.abs(wheel) < WHEEL_STEP) return;
        const rect = host.getBoundingClientRect();
        this.layers[this.active].camera.zoomStep(event.clientX - rect.left, event.clientY - rect.top, wheel > 0 ? -1 : 1);
        wheel = 0;
        this.applyCamera();
      },
      { signal, passive: false },
    );
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
        if (!this.app) return;
        const cx = this.app.screen.width / 2;
        const cy = this.app.screen.height / 2;
        const camera = this.layers[this.active].camera;
        if (event.key === 'Escape') {
          this.showScene(nextScene(this.active, { kind: 'escape' }));
        } else if (event.key === '+' || event.key === '=' || event.key === 'NumpadAdd') {
          event.preventDefault();
          camera.zoomStep(cx, cy, 1);
          this.applyCamera();
        } else if (event.key === '-' || event.key === '_' || event.key === 'NumpadSubtract') {
          event.preventDefault();
          camera.zoomStep(cx, cy, -1);
          this.applyCamera();
        } else if (event.key === '0' || event.key === 'Home') {
          event.preventDefault();
          this.fit();
        }
      },
      { signal },
    );
  }

  private syncActors(): void {
    if (!this.view || !this.dollsReady) return;

    const seenConsultants = new Set(this.view.consultants.map((model) => model.id));
    for (const [id, sprite] of this.consultants) {
      if (!seenConsultants.has(id)) {
        sprite.destroy();
        this.consultants.delete(id);
      }
    }
    const seenCollab = new Set(this.view.collaborators.map((model) => model.id));
    for (const [id, sprite] of this.collaborators) {
      if (!seenCollab.has(id)) {
        sprite.destroy();
        this.collaborators.delete(id);
      }
    }

    for (const model of this.view.consultants) {
      if (this.consultants.has(model.id)) continue;
      const sheets = this.dolls.sheetsFor(model.conversationId);
      if (!sheets) continue;
      this.consultants.set(model.id, new ConsultantSprite(sheets, model));
    }
    for (const model of this.view.collaborators) {
      if (this.collaborators.has(model.id)) continue;
      const sheets = this.dolls.sheetsFor(model.appearanceId);
      if (!sheets) continue;
      this.collaborators.set(model.id, new ConsultantSprite(sheets, model, COLLABORATOR_SCALE));
    }

    this.applySnapshots(this.presence.step(0, this.reducedMotion), 0);
  }

  private tick(deltaMs: number): void {
    if (!this.view || !this.dollsReady) return;
    this.applySnapshots(this.presence.step(deltaMs, this.reducedMotion), deltaMs);
    if (!this.reducedMotion && this.campfireFrames.length > 1) {
      this.campfireMs += deltaMs;
      const frame = this.campfireFrames[Math.floor(this.campfireMs / 180) % 4];
      if (frame) for (const sprite of this.campfireSprites) sprite.texture = frame;
    }
    if (this.flameFrames.length > 0) {
      this.flameMs = this.reducedMotion ? 0 : this.flameMs + deltaMs;
      const frame = this.flameFrames[Math.floor(this.flameMs / FLAME_MS) % this.flameFrames.length];
      if (frame) for (const sprite of this.flameSprites) sprite.texture = frame;
    }
  }

  /** Each body is drawn once, in the scene its zone says. Off-stage scenes still move. */
  private applySnapshots(snaps: PresenceSnapshot[], deltaMs: number): void {
    if (!this.view) return;
    const byId = new Map(snaps.map((snap) => [snap.id, snap]));
    const place = (sprite: ConsultantSprite, snap: PresenceSnapshot) => {
      const actors = this.layers[snap.zone === 'cabin' ? 'cabin' : 'yard'].actors;
      if (sprite.root.parent !== actors) actors.addChild(sprite.root);
    };

    for (const model of this.view.consultants) {
      const sprite = this.consultants.get(model.id);
      const snap = byId.get(model.id);
      if (!sprite || !snap) continue;
      place(sprite, snap);
      sprite.draw(model, snap, deltaMs);
    }
    for (const model of this.view.collaborators) {
      const sprite = this.collaborators.get(model.id);
      const snap = byId.get(model.id);
      if (!sprite || !snap) continue;
      place(sprite, snap);
      sprite.draw(model, snap, deltaMs);
    }
  }
}

const WHEEL_STEP = 80;

function makeLayer(size: { width: number; height: number }): SceneLayer {
  const world = new Container();
  const actors = new Container();
  // Tile ground vs the Y-sort layer. Feet, prop bases, and foreground pieces sort inside actors.
  world.sortableChildren = true;
  actors.sortableChildren = true;
  actors.zIndex = 0;
  world.addChild(actors);
  return { world, actors, camera: new MapCamera(), size, fitted: false };
}

function staticSprite(texture: Texture, x: number, y: number): Sprite {
  const sprite = new Sprite(texture);
  sprite.position.set(x, y);
  sprite.roundPixels = true;
  sprite.eventMode = 'none';
  return sprite;
}

function anchored(texture: Texture, at: { x: number; y: number; z: number }): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 1);
  sprite.position.set(Math.round(at.x), Math.round(at.y));
  sprite.zIndex = at.z;
  sprite.roundPixels = true;
  sprite.eventMode = 'none';
  return sprite;
}

async function loadNearest(url: string): Promise<Texture> {
  const texture = await Assets.load<Texture>(url);
  texture.source.scaleMode = 'nearest';
  texture.source.autoGenerateMipmaps = false;
  return texture;
}

async function loadProps(): Promise<PropTextures> {
  const entries = await Promise.all(
    (Object.keys(PROP_URL) as PropKind[]).map(async (kind) => {
      const urls = PROP_URL[kind];
      const base = await loadNearest(urls.base);
      if (!urls.foreground) return [kind, { base }] as const;
      return [kind, { base, foreground: await loadNearest(urls.foreground) }] as const;
    }),
  );
  return Object.fromEntries(entries) as PropTextures;
}
