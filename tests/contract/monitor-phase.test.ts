import { describe, expect, it } from 'vitest';
import { monitorFrame, monitorPhase, monitorTexture } from '../../src/renderer/office/monitor-phase';

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

  it('blinks a booting screen and holds the other phases', () => {
    expect(monitorTexture('off', true)).toBe('off');
    expect(monitorTexture('working', false)).toBe('working');
    expect(monitorTexture('standby', true)).toBe('standby');
    expect(monitorTexture('booting', true)).toBe('working');
    expect(monitorTexture('booting', false)).toBe('off');
  });
});
