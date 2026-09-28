import { Container, Graphics, Text } from 'pixi.js';
import { createDesk, createNpcAvatar } from './assets';
import type { CollaboratorViewModel, ConsultantViewModel } from './projection';

const BADGE_COLOR: Record<string, number> = {
  observed: 0x2f6f8f,
  inferred: 0xb0892c,
  ambient: 0x5a6675,
  stale: 0x8b5a2b,
};

export class ConsultantSprite {
  readonly root = new Container();
  private readonly avatar: Graphics;
  private readonly badge: Graphics;
  private readonly label: Text;
  private readonly desk: Graphics;
  private baseX = 0;
  private baseY = 0;

  constructor(model: ConsultantViewModel) {
    this.desk = createDesk(0, 0, model.accentHue);
    this.avatar = createNpcAvatar(model.accentHue);
    this.badge = new Graphics();
    this.label = new Text({
      text: model.label,
      style: {
        fontFamily: 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif',
        fontSize: 12,
        fill: 0x1c2430,
      },
    });
    this.label.anchor.set(0.5, 1);
    this.root.addChild(this.desk);
    this.root.addChild(this.avatar);
    this.root.addChild(this.badge);
    this.root.addChild(this.label);
    this.apply(model, 0, 0);
  }

  apply(model: ConsultantViewModel, offsetX: number, offsetY: number): void {
    this.baseX = model.x;
    this.baseY = model.y;
    this.root.x = model.x + offsetX;
    this.root.y = model.y + offsetY;
    this.label.text = model.label;
    this.label.y = -22;
    this.badge.clear();
    this.badge.circle(16, -10, 4);
    const badgeColor = BADGE_COLOR[model.badge] ?? 0x2f6f8f;
    this.badge.fill({ color: badgeColor });
    // Active consultants sit upright at the desk (no ambient offset applied by caller).
    this.avatar.alpha = model.workState === 'stale' ? 0.55 : 1;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

export class CollaboratorSprite {
  readonly root = new Container();
  private readonly avatar: Graphics;
  private readonly label: Text;

  constructor(model: CollaboratorViewModel) {
    this.avatar = createNpcAvatar(200, 9);
    this.label = new Text({
      text: model.label,
      style: {
        fontFamily: 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif',
        fontSize: 10,
        fill: 0x5a6675,
      },
    });
    this.label.anchor.set(0.5, 1);
    this.label.y = -14;
    this.root.addChild(this.avatar);
    this.root.addChild(this.label);
    this.apply(model);
  }

  apply(model: CollaboratorViewModel): void {
    this.root.x = model.x;
    this.root.y = model.y;
    this.label.text = model.label;
    this.avatar.alpha = model.workState === 'stale' ? 0.5 : 0.9;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
