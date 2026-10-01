import 'pixi.js/unsafe-eval';
import { Application, Assets, Container, Sprite, Text, type Texture } from 'pixi.js';
import {
  BUSH_VARIANTS,
  CABIN_FLAME_URLS,
  CABIN_FLOOR_URL,
  CABIN_PROP_URL,
  COMPUTER_SCREEN_URL,
  CABIN_WALL_URLS,
  CAMPFIRE_FRAME_URL,
  BUTTERFLY_FRAME_URL,
  CROP_STAGE_URL,
  CARRIED_LOG_URL,
  DOZE_BUBBLE_URL,
  LILY_FRAME_URL,
  REED_FRAME_URL,
  CANOPY_VARIANTS,
  PROP_URL,
} from './art';
import { DollLibrary } from './doll-textures';
import { MapCamera } from './camera';
import { createGround } from './ground';
import { createPropSprites, type PropTextures } from './prop-view';
import { GROUND_DEPTH } from './depth';
import { PROPS, PROP_SPECS, lodgeShellSolid, propBase, terrainAt, type PropKind } from './world-layout';
import { butterflyFlights, butterflyPose, glideToward, type ButterflyFlight, type FlightPoint } from './butterflies';
import { ErrandBoard } from './errand-board';
import { claimBeds, gardenAction, initialGarden, stepGarden, type GardenState } from './garden-cycle';
import { fishFrame, initialFish, stepFish, type FishState } from './fish-cycle';
import { lilyFrame, lilyOffsetY } from './lily-motion';
import { combinePhases, monitorTexture, type MonitorPhase } from './monitor-phase';
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
import { ConsultantSprite, type ErrandItems } from './consultant-view';
import { COLLABORATOR_SCALE, type OfficeViewModel } from './projection';
import { WORLD } from './landmarks';
import { PresenceDirector, type PresenceSnapshot } from './presence';
import { START_SCENE, nextScene, portalAt, type SceneId } from './scene-state';
import { visibleInScene } from './scene-visibility';

const TILE = 16;
const FLAME_MS = 150;
/** Clear color around the world: the yard keeps its cream margin, the cabin sits in the dark. */
const BACKDROP: Record<SceneId, number> = { yard: 0xfff8f1, cabin: 0x1c0a18 };
const CLICK_SLOP = 4;
/** Fastest a butterfly may be drawn moving, px/s, even when scared by a net. */
const BUTTERFLY_GLIDE = 28;

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
  private butterflySprites: Sprite[] = [];
  private butterflyFrames: Texture[] = [];
  private flights: ButterflyFlight[] = [];
  private butterflyDrawn: FlightPoint[] = [];
  private lilySprites: Sprite[] = [];
  private lilyBaseY: number[] = [];
  private reedSprites: Sprite[] = [];
  private reedBaseY: number[] = [];
  private lilyFrames: Texture[] = [];
  private reedFrames: Texture[] = [];
  private cropFrames: Texture[] = [];
  private errandItems: ErrandItems | null = null;
  private readonly cropSprites = new Map<string, Sprite>();
  private readonly beds = new Map<string, GardenState>();
  private readonly fishing = new Map<string, FishState>();
  private readonly errands = new ErrandBoard();
  private ambientMs = 0;
  private flameFrames: Texture[] = [];
  private flameSprites: Sprite[] = [];
  private flameMs = 0;
  private computerSprites: Sprite[] = [];
  private screenTextures: Partial<Record<'off' | 'working' | 'standby', Texture>> = {};
  private screenMs = 0;
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
    this.app = app;    host.appendChild(app.canvas);
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
      const [propTextures, canopies, bushes, log, doze] = await Promise.all([
        loadProps(),
        Promise.all(CANOPY_VARIANTS.map((url) => loadNearest(url))),
        Promise.all(BUSH_VARIANTS.map((url) => loadNearest(url))),
        loadNearest(CARRIED_LOG_URL),
        loadNearest(DOZE_BUBBLE_URL),
        this.dolls.load(),
        this.buildCabin(),
      ]);
      this.errandItems = { log, doze };
      this.dollsReady = true;
      if (this.destroyed) return;
      const props = createPropSprites(PROPS, propTextures, { canopies, bushes });
      for (const sprite of props) this.layers.yard.actors.addChild(sprite);
      this.campfireSprites = props.filter((sprite) => sprite.label === 'campfire');
      this.lilySprites = props.filter((sprite) => sprite.label === 'lily');
      this.lilyBaseY = this.lilySprites.map((sprite) => sprite.y);
      this.reedSprites = props.filter((sprite) => sprite.label === 'reed');
      this.reedBaseY = this.reedSprites.map((sprite) => sprite.y);
      this.campfireFrames = await Promise.all(CAMPFIRE_FRAME_URL.map((url) => loadNearest(url)));
      this.butterflyFrames = await Promise.all(BUTTERFLY_FRAME_URL.map((url) => loadNearest(url)));
      this.lilyFrames = await Promise.all(LILY_FRAME_URL.map((url) => loadNearest(url)));
      this.reedFrames = await Promise.all(REED_FRAME_URL.map((url) => loadNearest(url)));
      this.cropFrames = await Promise.all(CROP_STAGE_URL.map((url) => loadNearest(url)));
      this.spawnButterflies();
      this.spawnCrops();
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
    const parentByConversation = new Map(view.consultants.map((consultant) => [consultant.conversationId, consultant.id]));
    this.presence.sync([
      ...view.consultants.map((consultant) => ({
        id: consultant.id,
        workState: consultant.workState,
        ambientEligible: consultant.ambientEligible,
        lastObservedAt: consultant.lastObservedAt,
      })),
      ...view.collaborators.map((collaborator) => {
        const parentId = parentByConversation.get(collaborator.parentId);
        return {
          id: collaborator.id,
          workState: collaborator.workState,
          ambientEligible: false as const,
          lastObservedAt: collaborator.lastObservedAt,
          ...(parentId !== undefined ? { parentId } : {}),
        };
      }),
    ], Date.now());
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
    const [floor, walls, flames, props, screens] = await Promise.all([
      loadNearest(CABIN_FLOOR_URL),
      Promise.all(CABIN_WALL_URLS.map((url) => loadNearest(url))),
      Promise.all(CABIN_FLAME_URLS.map((url) => loadNearest(url))),
      Promise.all((Object.keys(CABIN_PROP_URL) as CabinPropKind[]).map(async (kind) => [kind, await loadNearest(CABIN_PROP_URL[kind])] as const)),
      Promise.all((Object.keys(COMPUTER_SCREEN_URL) as (keyof typeof COMPUTER_SCREEN_URL)[]).map(async (key) => [key, await loadNearest(COMPUTER_SCREEN_URL[key])] as const)),
    ]);
    const textures = Object.fromEntries(props) as Record<CabinPropKind, Texture>;
    this.screenTextures = Object.fromEntries(screens);

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
      if (placement.kind === 'computer') this.computerSprites.push(sprite);
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
      this.consultants.set(model.id, new ConsultantSprite(sheets, model, 1, this.errandItems));
    }
    for (const model of this.view.collaborators) {
      if (this.collaborators.has(model.id)) continue;
      const sheets = this.dolls.sheetsFor(model.appearanceId);
      if (!sheets) continue;
      this.collaborators.set(model.id, new ConsultantSprite(sheets, model, COLLABORATOR_SCALE, this.errandItems));
    }

    this.applySnapshots(this.presence.step(0, this.reducedMotion, Date.now()), 0);
  }

  private tick(deltaMs: number): void {
    if (!this.view || !this.dollsReady) return;
    const butterflies = this.butterflyPoints();
    this.presence.setAims(this.errands.aims([...this.lastSnaps.values()], this.reducedMotion, butterflies));
    const snaps = this.presence.step(deltaMs, this.reducedMotion, Date.now());
    this.lastSnaps = new Map(snaps.map((snap) => [snap.id, snap]));
    this.errands.advance({
      snaps,
      deltaMs,
      reduced: this.reducedMotion,
      now: Date.now(),
      butterflies,
      blocked: (x, y) => yardPointBlocked(x, y),
    });
    this.stepGarden(deltaMs);
    this.stepFishing(deltaMs);
    this.applySnapshots(snaps, deltaMs);
    this.paintMonitors(deltaMs);
    if (!this.reducedMotion && this.campfireFrames.length > 1) {
      this.campfireMs += deltaMs;
      const frame = this.campfireFrames[Math.floor(this.campfireMs / 180) % 4];
      if (frame) for (const sprite of this.campfireSprites) sprite.texture = frame;
    }
    this.animateAmbient(deltaMs);
    if (this.flameFrames.length > 0) {
      this.flameMs = this.reducedMotion ? 0 : this.flameMs + deltaMs;
      const frame = this.flameFrames[Math.floor(this.flameMs / FLAME_MS) % this.flameFrames.length];
      if (frame) for (const sprite of this.flameSprites) sprite.texture = frame;
    }
  }

  /** The desk screen follows the consultant sitting there. An empty desk stays off. */
  private paintMonitors(deltaMs: number): void {
    if (!this.reducedMotion) this.screenMs += deltaMs;
    const phaseByDesk = new Map<number, MonitorPhase>();
    for (const snap of this.lastSnaps.values()) {
      if (snap.deskIndex < 0) continue;
      const previous = phaseByDesk.get(snap.deskIndex);
      phaseByDesk.set(snap.deskIndex, previous ? combinePhases([previous, snap.monitor]) : snap.monitor);
    }
    const blinkOn = this.reducedMotion || Math.floor(this.screenMs / 180) % 2 === 1;
    this.computerSprites.forEach((sprite, index) => {
      const texture = this.screenTextures[monitorTexture(phaseByDesk.get(index) ?? 'off', blinkOn)];
      if (texture) sprite.texture = texture;
    });
  }

  /** Each body is drawn once, in the scene its zone says. Off-stage scenes still move. */
  private applySnapshots(snaps: PresenceSnapshot[], deltaMs: number): void {
    if (!this.view) return;
    const byId = new Map(snaps.map((snap) => [snap.id, snap]));
    const place = (sprite: ConsultantSprite, snap: PresenceSnapshot) => {
      if (!visibleInScene(this.active, snap)) {
        sprite.root.visible = false;
        return;
      }
      const actors = this.layers[snap.zone].actors;
      if (sprite.root.parent !== actors) actors.addChild(sprite.root);
      sprite.root.visible = true;
    };

    for (const model of this.view.consultants) {
      const sprite = this.consultants.get(model.id);
      const snap = byId.get(model.id);
      if (!sprite) continue;
      if (!snap) {
        sprite.root.visible = false;
        continue;
      }
      sprite.root.visible = true;
      place(sprite, snap);
      if (!sprite.root.visible) continue;
      sprite.draw(model, snap, deltaMs, this.gardenPose(model.id, snap), this.fishPose(model.id, snap), this.errands.pose(model.id, !this.reducedMotion));
    }
    for (const model of this.view.collaborators) {
      const sprite = this.collaborators.get(model.id);
      const snap = byId.get(model.id);
      if (!sprite) continue;
      if (!snap) {
        sprite.root.visible = false;
        continue;
      }
      sprite.root.visible = true;
      place(sprite, snap);
      if (!sprite.root.visible) continue;
      sprite.draw(model, snap, deltaMs, this.gardenPose(model.id, snap), this.fishPose(model.id, snap), this.errands.pose(model.id, !this.reducedMotion));
    }
  }

  private gardenPose(id: string, snap: PresenceSnapshot): { action: 'hoe' | 'sit' | 'water' | 'idle'; play: boolean } | null {
    if (snap.leisure !== 'garden' || snap.zone !== 'yard') return null;
    const bed = this.bedFor(id);
    if (!bed) return null;
    const state = this.beds.get(`${bed.col},${bed.row}`);
    if (!state) return null;
    return { action: gardenAction(state.phase), play: !this.reducedMotion && !snap.moving };
  }

  private fishPose(id: string, snap: PresenceSnapshot): { phase: FishState['phase']; frame: number; play: boolean } | null {
    if (snap.leisure !== 'fishing' || snap.zone !== 'yard' || snap.moving) return null;
    const state = this.fishing.get(id);
    if (!state) return null;
    return { phase: state.phase, frame: fishFrame(state.phase, state.phaseMs), play: !this.reducedMotion };
  }

  private butterflyPoints(): { x: number; y: number }[] {
    return this.flights.map(
      (flight, index) => this.butterflyDrawn[index] ?? butterflyPose(flight, this.ambientMs + index * 900, this.reducedMotion),
    );
  }

  private stepFishing(deltaMs: number): void {
    const live = new Set<string>();
    for (const [id, snap] of this.lastSnaps) {
      if (snap.leisure !== 'fishing' || snap.zone !== 'yard') continue;
      live.add(id);
      const prev = this.fishing.get(id) ?? initialFish();
      this.fishing.set(id, stepFish(prev, deltaMs, !snap.moving, this.reducedMotion));
    }
    for (const id of this.fishing.keys()) {
      if (!live.has(id)) this.fishing.delete(id);
    }
  }

  private bedFor(id: string): { col: number; row: number } | undefined {
    const ids = [...this.consultants.keys()].filter((key) => {
      const snap = this.lastSnaps.get(key);
      return snap?.leisure === 'garden' && snap.zone === 'yard';
    });
    return claimBeds(ids, gardenBeds()).get(id);
  }

  private lastSnaps = new Map<string, PresenceSnapshot>();

  private stepGarden(deltaMs: number): void {
    const beds = gardenBeds();
    for (const bed of beds) {
      const key = `${bed.col},${bed.row}`;
      if (!this.beds.has(key)) this.beds.set(key, initialGarden());
    }
    const ids = [...this.lastSnaps.entries()]
      .filter(([, snap]) => snap.leisure === 'garden' && snap.zone === 'yard')
      .map(([id]) => id);
    const owned = claimBeds(ids, beds);
    const present = new Set(
      [...owned.entries()]
        .filter(([id]) => !this.lastSnaps.get(id)?.moving)
        .map(([, bed]) => `${bed.col},${bed.row}`),
    );
    for (const [key, state] of this.beds) {
      const next = stepGarden(state, deltaMs, present.has(key), this.reducedMotion);
      this.beds.set(key, next);
      const sprite = this.cropSprites.get(key);
      if (!sprite) continue;
      const frame = this.cropFrames[next.stage];
      if (frame) sprite.texture = frame;
      sprite.visible = next.phase !== 'till';
    }
  }

  private spawnButterflies(): void {
    const perches = PROPS
      .filter((prop) => prop.kind === 'flower' || prop.kind === 'bush')
      .map((prop) => propBase(prop));
    const blocked = (x: number, y: number) => yardPointBlocked(x, y);
    this.flights = butterflyFlights(perches, blocked);
    const frame = this.butterflyFrames[0];
    if (!frame) return;
    for (const flight of this.flights) {
      const sprite = new Sprite(frame);
      sprite.anchor.set(0.5, 1);
      sprite.roundPixels = true;
      sprite.eventMode = 'none';
      sprite.label = 'butterfly';
      sprite.position.set(flight.home.x, flight.home.y);
      this.butterflyDrawn.push({ ...flight.home });
      this.layers.yard.actors.addChild(sprite);
      this.butterflySprites.push(sprite);
    }
  }

  private spawnCrops(): void {
    const frame = this.cropFrames[0];
    if (!frame) return;
    for (const bed of gardenBeds()) {
      const { x, y } = propBase({ kind: 'gardenBed', ...bed });
      const sprite = new Sprite(frame);
      sprite.anchor.set(0.5, 1);
      sprite.roundPixels = true;
      sprite.eventMode = 'none';
      sprite.visible = false;
      sprite.position.set(Math.round(x), y - 8);
      sprite.zIndex = y;
      this.layers.yard.actors.addChild(sprite);
      this.cropSprites.set(`${bed.col},${bed.row}`, sprite);
    }
  }

  private animateAmbient(deltaMs: number): void {
    if (!this.reducedMotion) this.ambientMs += deltaMs;
    if (this.active !== 'yard') return;
    this.flights.forEach((flight, index) => {
      const sprite = this.butterflySprites[index];
      if (!sprite) return;
      const route = butterflyPose(flight, this.ambientMs + index * 900, this.reducedMotion);
      const target = this.errands.butterflyAt(index) ?? route;
      const drawn = this.reducedMotion
        ? { x: target.x, y: target.y }
        : glideToward(this.butterflyDrawn[index] ?? target, target, deltaMs, BUTTERFLY_GLIDE);
      this.butterflyDrawn[index] = drawn;
      sprite.position.set(Math.round(drawn.x), Math.round(drawn.y));
      sprite.zIndex = drawn.y;
      const frame = this.butterflyFrames[route.frame];
      if (frame) sprite.texture = frame;
    });
    this.lilySprites.forEach((sprite, index) => {
      const frame = this.lilyFrames[lilyFrame(index, this.ambientMs, this.reducedMotion)];
      if (frame) sprite.texture = frame;
      const base = this.lilyBaseY[index];
      if (base !== undefined) sprite.y = base + lilyOffsetY(index, this.ambientMs, this.reducedMotion);
    });
    this.reedSprites.forEach((sprite, index) => {
      const frame = this.reedFrames[lilyFrame(index + 3, this.ambientMs, this.reducedMotion)];
      if (frame) sprite.texture = frame;
      const base = this.reedBaseY[index];
      if (base !== undefined) sprite.y = base + lilyOffsetY(index + 3, this.ambientMs, this.reducedMotion);
    });
  }
}

const WHEEL_STEP = 80;

function gardenBeds(): { col: number; row: number }[] {
  return PROPS.filter((prop) => prop.kind === 'gardenBed').map((prop) => ({ col: prop.col, row: prop.row }));
}

function yardPointBlocked(x: number, y: number): boolean {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (lodgeShellSolid(col, row) || terrainAt(col, row) !== 'grass') return true;
  return PROPS.some((prop) => PROP_SPECS[prop.kind].blocks.some(([dx, dy]) => prop.col + dx === col && prop.row + dy === row));
}

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
