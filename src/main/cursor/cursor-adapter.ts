import { createHash } from 'node:crypto';
import type { CanonicalFact, CanonicalFactKind } from '../../domain/events';

/** Allowlisted keys extracted from Cursor hook JSON. Never keep prompt/tool I/O/etc. */
const ALLOWLIST = [
  'hook_event_name',
  'conversation_id',
  'generation_id',
  'subagent_id',
  'parent_conversation_id',
  'subagent_type',
  'tool_name',
  'tool_use_id',
  'tool_call_id',
  'cursor_version',
  'session_id',
] as const;

export type AllowlistedCursorFields = {
  hook_event_name?: string;
  conversation_id?: string;
  generation_id?: string;
  subagent_id?: string;
  parent_conversation_id?: string;
  subagent_type?: string;
  tool_name?: string;
  /** Official id for preToolUse / postToolUse / postToolUseFailure. */
  tool_use_id?: string;
  /** Official id on subagentStart for the triggering Task tool call. */
  tool_call_id?: string;
  cursor_version?: string;
  session_id?: string;
};

const WORK_HOOKS = new Set([
  'beforeSubmitPrompt',
  'preToolUse',
  'postToolUse',
  'postToolUseFailure',
  'afterAgentResponse',
]);

export function sanitizeCursorPayload(raw: unknown): AllowlistedCursorFields | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const src = raw as Record<string, unknown>;
  const out: AllowlistedCursorFields = {};
  for (const key of ALLOWLIST) {
    const value = src[key];
    if (typeof value === 'string' && value.length > 0 && value.length < 512) {
      out[key] = value;
    }
  }
  return out;
}

export function adaptCursorHook(
  hookName: string,
  payload: AllowlistedCursorFields,
  receivedAt: number,
): CanonicalFact | null {
  const eventName = hookName || payload.hook_event_name;
  if (!eventName) {
    return null;
  }

  const conversationId = payload.conversation_id ?? payload.session_id;
  if (!conversationId) {
    return null;
  }

  const kind = mapKind(eventName);
  if (!kind) {
    return null;
  }

  const fingerprint = fingerprintFor(eventName, payload, conversationId);
  const fact: CanonicalFact = {
    kind,
    sourceId: 'cursor',
    conversationId,
    fingerprint,
    receivedAt,
  };

  if (payload.generation_id) fact.generationId = payload.generation_id;
  if (payload.subagent_id) fact.subagentId = payload.subagent_id;
  if (payload.parent_conversation_id) {
    fact.parentConversationId = payload.parent_conversation_id;
  } else if (kind === 'collaborator_started' || kind === 'collaborator_stopped') {
    fact.parentConversationId = conversationId;
  }
  if (payload.subagent_type) fact.collaboratorType = payload.subagent_type;
  if (payload.cursor_version) fact.cursorVersion = payload.cursor_version;

  return fact;
}

function mapKind(eventName: string): CanonicalFactKind | null {
  if (WORK_HOOKS.has(eventName)) return 'work_observed';
  if (eventName === 'stop') return 'generation_stopped';
  if (eventName === 'subagentStart') return 'collaborator_started';
  if (eventName === 'subagentStop') return 'collaborator_stopped';
  return null;
}

function fingerprintFor(
  eventName: string,
  payload: AllowlistedCursorFields,
  conversationId: string,
): string {
  const material = [
    'cursor',
    eventName,
    conversationId,
    payload.generation_id ?? '',
    payload.subagent_id ?? '',
    payload.tool_use_id ?? '',
    payload.tool_call_id ?? '',
    payload.tool_name ?? '',
    payload.parent_conversation_id ?? '',
  ].join('|');
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}
