export const SUBSCRIBED_HOOKS = [
  'beforeSubmitPrompt',
  'preToolUse',
  'postToolUse',
  'postToolUseFailure',
  'subagentStart',
  'subagentStop',
  'afterAgentResponse',
  'stop',
] as const;

export type SubscribedHook = (typeof SUBSCRIBED_HOOKS)[number];

export const OFFICE_HOOK_MARKER = 'cursor-office-observer';

export const RETAINED_FIELDS_FOR_PREVIEW = [
  'hook_event_name',
  'conversation_id',
  'generation_id',
  'subagent_id',
  'parent_conversation_id',
  'collaborator_type / subagent_type',
  'tool_name',
  'tool_use_id',
  'tool_call_id',
  'cursor_version',
  'fingerprint (derived)',
  'receivedAt (collector)',
] as const;

export interface HookCommandEntry {
  type?: string;
  command: string;
  timeout?: number;
  matcher?: string;
  [key: string]: unknown;
}

/** Parsed hooks.json preserving unknown top-level keys (AE7). */
export type HooksFile = {
  version: number;
  hooks: Record<string, HookCommandEntry[]>;
} & Record<string, unknown>;

export function isOfficeOwnedEntry(entry: HookCommandEntry): boolean {
  return typeof entry.command === 'string' && entry.command.includes(OFFICE_HOOK_MARKER);
}

export function buildOfficeCommand(wrapperPath: string, hookName: SubscribedHook): string {
  return `"${wrapperPath}" ${hookName} # ${OFFICE_HOOK_MARKER}`;
}

export function parseHooksFile(raw: string): HooksFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Invalid hooks.json: not JSON');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid hooks.json: expected object');
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new Error('Invalid hooks.json: unsupported or missing version (expected 1)');
  }
  if (obj.hooks === null || typeof obj.hooks !== 'object' || Array.isArray(obj.hooks)) {
    throw new Error('Invalid hooks.json: hooks must be an object');
  }

  const hooks: Record<string, HookCommandEntry[]> = {};
  for (const [name, value] of Object.entries(obj.hooks as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      throw new Error(`Invalid hooks.json: hooks.${name} must be an array`);
    }
    hooks[name] = value.map((entry, index) => {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`Invalid hooks.json: hooks.${name}[${index}] must be an object`);
      }
      const command = (entry as { command?: unknown }).command;
      if (typeof command !== 'string' || command.length === 0) {
        throw new Error(`Invalid hooks.json: hooks.${name}[${index}].command must be a string`);
      }
      return entry as HookCommandEntry;
    });
  }

  // Preserve unknown top-level keys byte-equivalent in meaning.
  return { ...obj, version: 1, hooks };
}

export function mergeOfficeHooks(
  existing: HooksFile | null,
  wrapperPath: string,
): HooksFile {
  const base: HooksFile = existing
    ? { ...existing, version: 1, hooks: { ...existing.hooks } }
    : { version: 1, hooks: {} };

  for (const hookName of SUBSCRIBED_HOOKS) {
    const current = [...(base.hooks[hookName] ?? [])].filter((e) => !isOfficeOwnedEntry(e));
    current.push({
      command: buildOfficeCommand(wrapperPath, hookName),
    });
    base.hooks[hookName] = current;
  }

  return base;
}

export function removeOfficeHooks(existing: HooksFile): HooksFile {
  const hooks: Record<string, HookCommandEntry[]> = {};
  for (const [name, entries] of Object.entries(existing.hooks)) {
    const kept = entries.filter((e) => !isOfficeOwnedEntry(e));
    if (kept.length > 0) {
      hooks[name] = kept;
    }
  }
  return { ...existing, version: 1, hooks };
}

export function responseForHook(hookName: string): string {
  switch (hookName) {
    case 'preToolUse':
    case 'subagentStart':
      return '{"permission":"allow"}';
    case 'beforeSubmitPrompt':
      return '{"continue":true}';
    default:
      return '{}';
  }
}
