import { describe, expect, it } from 'vitest';
import {
  adaptCursorHook,
  sanitizeCursorPayload,
} from '../../src/main/cursor/cursor-adapter';
import {
  CLI_WORK_FIXTURE,
  FORBIDDEN_STRINGS,
  IDE_WORK_FIXTURE,
  SENSITIVE_FIXTURE,
  STOP_FIXTURE,
  SUBAGENT_START_FIXTURE,
} from '../fixtures/cursor-hooks';

describe('CursorHookAdapter', () => {
  it('strips sensitive fields and maps IDE work to work_observed', () => {
    const sanitized = sanitizeCursorPayload(SENSITIVE_FIXTURE);
    expect(sanitized).not.toBeNull();
    const json = JSON.stringify(sanitized);
    for (const secret of FORBIDDEN_STRINGS) {
      expect(json).not.toContain(secret);
    }

    const fact = adaptCursorHook('preToolUse', sanitized!, 1000);
    expect(fact?.kind).toBe('work_observed');
    expect(fact?.conversationId).toBe('conv-ide-1');
    expect(fact?.generationId).toBe('gen-42');
    expect(JSON.stringify(fact)).not.toMatch(/SECRET_/);
  });

  it('maps IDE and CLI fixtures to the same canonical fingerprint material', () => {
    const ide = adaptCursorHook('postToolUse', sanitizeCursorPayload(IDE_WORK_FIXTURE)!, 1);
    const cli = adaptCursorHook('postToolUse', sanitizeCursorPayload(CLI_WORK_FIXTURE)!, 1);
    expect(ide?.fingerprint).toBe(cli?.fingerprint);
    expect(ide?.conversationId).toBe(cli?.conversationId);
  });

  it('maps stop and subagent lifecycle hooks', () => {
    const stop = adaptCursorHook('stop', sanitizeCursorPayload(STOP_FIXTURE)!, 2);
    expect(stop?.kind).toBe('generation_stopped');

    const start = adaptCursorHook(
      'subagentStart',
      sanitizeCursorPayload(SUBAGENT_START_FIXTURE)!,
      3,
    );
    expect(start?.kind).toBe('collaborator_started');
    expect(start?.subagentId).toBe('sub-9');
    expect(start?.collaboratorType).toBe('explore');
  });

  it('ignores unsupported / cloud-only events without conversation identity', () => {
    const fact = adaptCursorHook(
      'workspaceOpen',
      sanitizeCursorPayload({ hook_event_name: 'workspaceOpen', cursor_version: '1.7.2' })!,
      4,
    );
    expect(fact).toBeNull();
  });

  it('uses tool_use_id so distinct tool calls produce distinct fingerprints', () => {
    const a = adaptCursorHook(
      'preToolUse',
      sanitizeCursorPayload({
        hook_event_name: 'preToolUse',
        conversation_id: 'c',
        generation_id: 'g',
        tool_name: 'Read',
        tool_use_id: 'tu-aaa',
      })!,
      1,
    );
    const b = adaptCursorHook(
      'preToolUse',
      sanitizeCursorPayload({
        hook_event_name: 'preToolUse',
        conversation_id: 'c',
        generation_id: 'g',
        tool_name: 'Read',
        tool_use_id: 'tu-bbb',
      })!,
      1,
    );
    expect(a?.fingerprint).not.toBe(b?.fingerprint);
  });

  it('keeps tool_call_id for subagentStart fingerprint material', () => {
    const start = adaptCursorHook(
      'subagentStart',
      sanitizeCursorPayload(SUBAGENT_START_FIXTURE)!,
      1,
    );
    const other = adaptCursorHook(
      'subagentStart',
      sanitizeCursorPayload({ ...SUBAGENT_START_FIXTURE, tool_call_id: 'tc-other', subagent_id: 'sub-other' })!,
      1,
    );
    expect(start?.fingerprint).not.toBe(other?.fingerprint);
  });
});
