import { describe, expect, it } from 'vitest';
import { monitorFrame, monitorPhase } from '../../src/renderer/office/monitor-phase';

describe('monitor phase', () => {
  it('maps desk state to the four sheet frames', () => {
    expect(monitorFrame({ mode: 'leisure', bootMs: 0, leaveMs: 0, atDesk: false })).toBe(0);
    expect(monitorPhase({ mode: 'work', bootMs: 0, leaveMs: 0, atDesk: false })).toBe('off');

    expect(monitorPhase({ mode: 'work', bootMs: 500, leaveMs: 0, atDesk: true })).toBe('booting');
    expect(monitorFrame({ mode: 'work', bootMs: 500, leaveMs: 0, atDesk: true })).toBe(1);

    expect(monitorPhase({ mode: 'work', bootMs: 0, leaveMs: 0, atDesk: true })).toBe('working');
    expect(monitorFrame({ mode: 'work', bootMs: 0, leaveMs: 0, atDesk: true })).toBe(2);

    expect(monitorPhase({ mode: 'toLeisure', bootMs: 0, leaveMs: 500, atDesk: true })).toBe('standby');
    expect(monitorFrame({ mode: 'hold', bootMs: 0, leaveMs: 0, atDesk: true })).toBe(3);

    expect(monitorPhase({ mode: 'hold', bootMs: 0, leaveMs: 0, atDesk: false })).toBe('off');
    expect(monitorPhase({ mode: 'leisure', bootMs: 0, leaveMs: 0, atDesk: false })).toBe('off');
    expect(monitorPhase({ mode: 'toLeisure', bootMs: 0, leaveMs: 0, atDesk: true })).toBe('off');
  });
});
