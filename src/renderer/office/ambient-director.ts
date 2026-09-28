export type AmbientBehavior = 'rest' | 'walk' | 'play' | 'socialize';

export interface AmbientAssignment {
  consultantId: string;
  behavior: AmbientBehavior;
  /** Offset from workstation; animation-only — never written back to domain. */
  offsetX: number;
  offsetY: number;
}

/**
 * Ambient locomotion reads projection eligibility only.
 * It must never mutate lastObservedAt / lease timestamps (those live in domain state).
 */
export class AmbientDirector {
  private readonly assignments = new Map<string, AmbientAssignment>();
  private phase = 0;

  tick(deltaMs: number, eligibleIds: string[], reducedMotion: boolean): AmbientAssignment[] {
    this.phase += deltaMs;

    // Drop assignments for consultants that left or became ineligible.
    for (const id of [...this.assignments.keys()]) {
      if (!eligibleIds.includes(id)) {
        this.assignments.delete(id);
      }
    }

    for (const id of eligibleIds) {
      if (!this.assignments.has(id)) {
        this.assignments.set(id, {
          consultantId: id,
          behavior: pickBehavior(id),
          offsetX: 0,
          offsetY: 0,
        });
      }
    }

    if (reducedMotion) {
      return [...this.assignments.values()].map((a) => ({
        ...a,
        behavior: 'rest',
        offsetX: 0,
        offsetY: 0,
      }));
    }

    const t = this.phase / 1000;
    return [...this.assignments.values()].map((a) => {
      const speed = a.behavior === 'walk' ? 18 : a.behavior === 'play' ? 26 : 10;
      const ox = Math.sin(t + hash(a.consultantId)) * speed;
      const oy = Math.cos(t * 0.7 + hash(a.consultantId)) * (speed * 0.35);
      return { ...a, offsetX: ox, offsetY: oy };
    });
  }

  interrupt(consultantId: string): void {
    this.assignments.delete(consultantId);
  }

  clear(): void {
    this.assignments.clear();
  }
}

function pickBehavior(id: string): AmbientBehavior {
  const behaviors: AmbientBehavior[] = ['rest', 'walk', 'play', 'socialize'];
  return behaviors[hash(id) % behaviors.length]!;
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}
