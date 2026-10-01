/** Screen phases. The sheet is four frames, in this order. */
export type MonitorPhase = 'off' | 'booting' | 'working' | 'standby';

export type SeatMode = 'arrive' | 'work' | 'toLeisure' | 'leisure' | 'toDesk' | 'hold';

export const MONITOR_FRAME: Record<MonitorPhase, 0 | 1 | 2 | 3> = {
  off: 0,
  booting: 1,
  working: 2,
  standby: 3,
};

export const BOOT_MS = 500;
export const STANDBY_MS = 500;

export interface MonitorInput {
  mode: SeatMode;
  bootMs: number;
  leaveMs: number;
  /** Feet are on this desk's seat. Away from the desk the screen stays off. */
  atDesk: boolean;
}

/**
 * Desk screen from presence, without touching the domain reducer.
 * Empty desk is off. Arrival boots, then works. Leaving holds standby while
 * the consultant is still in the chair. Stale at the desk is standby.
 */
export function monitorPhase(input: MonitorInput): MonitorPhase {
  if (!input.atDesk) return 'off';
  if (input.mode === 'work') return input.bootMs > 0 ? 'booting' : 'working';
  if (input.mode === 'toLeisure' && input.leaveMs > 0) return 'standby';
  if (input.mode === 'hold') return 'standby';
  return 'off';
}

export function monitorFrame(input: MonitorInput): 0 | 1 | 2 | 3 {
  return MONITOR_FRAME[monitorPhase(input)];
}

export type ScreenTexture = 'off' | 'working' | 'standby';

/** Which cached crop to draw. Booting blinks between off and working. */
export function monitorTexture(phase: MonitorPhase, blinkOn: boolean): ScreenTexture {
  if (phase === 'working') return 'working';
  if (phase === 'standby') return 'standby';
  if (phase === 'booting') return blinkOn ? 'working' : 'off';
  return 'off';
}

/** Highest phase wins when two consultants share a desk. */
const PHASE_RANK: Record<MonitorPhase, number> = {
  off: 0,
  standby: 1,
  booting: 2,
  working: 3,
};

export function combinePhases(phases: readonly MonitorPhase[]): MonitorPhase {
  return phases.reduce<MonitorPhase>((best, phase) => (
    PHASE_RANK[phase] > PHASE_RANK[best] ? phase : best
  ), 'off');
}
