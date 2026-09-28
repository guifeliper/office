import 'pixi.js/unsafe-eval';
import { Application, Container, Text } from 'pixi.js';
import { AmbientDirector } from './ambient-director';
import { createFloor } from './assets';
import { CollaboratorSprite, ConsultantSprite } from './consultant-view';
import type { OfficeViewModel } from './projection';

export class OfficeScene {
  private app: Application | null = null;
  private readonly world = new Container();
  private readonly actors = new Container();
  private readonly waitingLabel = new Text({
    text: 'Waiting for Cursor activity',
    style: {
      fontFamily: 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif',
      fontSize: 18,
      fill: 0x5a6675,
    },
  });
  private consultants = new Map<string, ConsultantSprite>();
  private collaborators = new Map<string, CollaboratorSprite>();
  private readonly ambient = new AmbientDirector();
  private view: OfficeViewModel | null = null;
  private reducedMotion = false;
  private floor: ReturnType<typeof createFloor> | null = null;

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    host.appendChild(app.canvas);
    this.app = app;
    this.waitingLabel.anchor.set(0.5);
    this.world.addChild(this.actors);
    this.world.addChild(this.waitingLabel);
    app.stage.addChild(this.world);

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    app.ticker.add((ticker) => {
      this.tick(ticker.deltaMS);
    });

    this.layout(host.clientWidth, host.clientHeight);
  }

  setView(view: OfficeViewModel): void {
    this.view = view;
    // Interrupt ambient when a consultant is no longer idle-eligible.
    for (const c of view.consultants) {
      if (!c.ambientEligible) {
        this.ambient.interrupt(c.id);
      }
    }
    this.syncActors();
  }

  resize(width: number, height: number): void {
    this.layout(width, height);
    if (this.view) {
      this.syncActors();
    }
  }

  destroy(): void {
    for (const sprite of this.consultants.values()) sprite.destroy();
    for (const sprite of this.collaborators.values()) sprite.destroy();
    this.consultants.clear();
    this.collaborators.clear();
    this.ambient.clear();
    this.app?.destroy(true);
    this.app = null;
  }

  private layout(width: number, height: number): void {
    if (!this.app) return;
    if (this.floor) {
      this.world.removeChild(this.floor);
      this.floor.destroy();
    }
    this.floor = createFloor(width, height);
    this.world.addChildAt(this.floor, 0);
    this.waitingLabel.x = width / 2;
    this.waitingLabel.y = height / 2;
  }

  private syncActors(): void {
    if (!this.view) return;

    this.waitingLabel.visible = this.view.waitingForActivity;

    const seenConsultants = new Set<string>();
    for (const model of this.view.consultants) {
      seenConsultants.add(model.id);
      let sprite = this.consultants.get(model.id);
      if (!sprite) {
        sprite = new ConsultantSprite(model);
        this.consultants.set(model.id, sprite);
        this.actors.addChild(sprite.root);
      }
      sprite.apply(model, 0, 0);
    }
    for (const [id, sprite] of this.consultants) {
      if (!seenConsultants.has(id)) {
        sprite.destroy();
        this.consultants.delete(id);
        this.ambient.interrupt(id);
      }
    }

    const seenCollab = new Set<string>();
    for (const model of this.view.collaborators) {
      seenCollab.add(model.id);
      let sprite = this.collaborators.get(model.id);
      if (!sprite) {
        sprite = new CollaboratorSprite(model);
        this.collaborators.set(model.id, sprite);
        this.actors.addChild(sprite.root);
      }
      sprite.apply(model);
    }
    for (const [id, sprite] of this.collaborators) {
      if (!seenCollab.has(id)) {
        sprite.destroy();
        this.collaborators.delete(id);
      }
    }
  }

  private tick(deltaMs: number): void {
    if (!this.view) return;
    const eligible = this.view.consultants.filter((c) => c.ambientEligible).map((c) => c.id);
    const assignments = this.ambient.tick(deltaMs, eligible, this.reducedMotion);
    const byId = new Map(assignments.map((a) => [a.consultantId, a]));

    for (const model of this.view.consultants) {
      const sprite = this.consultants.get(model.id);
      if (!sprite) continue;
      const ambient = byId.get(model.id);
      if (model.workState === 'active') {
        sprite.apply(model, 0, 0);
      } else {
        sprite.apply(model, ambient?.offsetX ?? 0, ambient?.offsetY ?? 0);
      }
    }
  }
}
