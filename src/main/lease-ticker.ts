import type { OfficeProjection } from '../domain/office-reducer';
import type { OfficeStore } from './storage/office-store';

export type ScheduleFn = (handler: () => void, intervalMs: number) => { clear: () => void };

export const defaultSchedule: ScheduleFn = (handler, intervalMs) => {
  const id = setInterval(handler, intervalMs);
  return { clear: () => clearInterval(id) };
};

/**
 * Single bounded interval that evaluates consultant leases and collaborator
 * fallbacks while the app is open (R9, R11, AE4).
 */
export class LeaseTicker {
  private handle: { clear: () => void } | null = null;

  constructor(
    private readonly store: OfficeStore,
    private readonly onChange: (projection: OfficeProjection) => void,
    private readonly intervalMs: number = 30_000,
    private readonly schedule: ScheduleFn = defaultSchedule,
  ) {}

  start(): void {
    this.stop();
    this.handle = this.schedule(() => {
      const { changed, projection } = this.store.tickLeases();
      if (changed) {
        this.onChange(projection);
      }
    }, this.intervalMs);
  }

  /** Deterministic test seam — run one evaluation immediately. */
  tickOnce(): OfficeProjection {
    const { projection, changed } = this.store.tickLeases();
    if (changed) {
      this.onChange(projection);
    }
    return projection;
  }

  stop(): void {
    this.handle?.clear();
    this.handle = null;
  }
}
