export const SENSITIVE_FIXTURE = {
  hook_event_name: 'preToolUse',
  conversation_id: 'conv-ide-1',
  generation_id: 'gen-42',
  cursor_version: '1.7.2',
  tool_name: 'Shell',
  tool_call_id: 'tc-1',
  prompt: 'SECRET_PROMPT_TEXT',
  response: 'SECRET_RESPONSE_BODY',
  thought: 'SECRET_THOUGHT_CHAIN',
  command: 'rm -rf /tmp/secret-cmd',
  tool_input: { query: 'tool_input_secret' },
  tool_output: 'tool_output_secret',
  file_path: 'file:///Users/secret/code.ts',
  user_email: 'secret@example.com',
  transcript_path: '/Users/secret/.cursor/projects/transcript.jsonl',
  token: 'tok_live_secret_token_value',
  raw: '{"raw":"body"}',
};

export const CLI_WORK_FIXTURE = {
  hook_event_name: 'postToolUse',
  conversation_id: 'conv-cli-1',
  generation_id: 'gen-7',
  cursor_version: '1.7.2',
  tool_name: 'Read',
  tool_call_id: 'tc-cli-1',
  prompt: 'SECRET_PROMPT_TEXT',
};

export const IDE_WORK_FIXTURE = {
  hook_event_name: 'postToolUse',
  conversation_id: 'conv-cli-1',
  generation_id: 'gen-7',
  cursor_version: '1.7.2',
  tool_name: 'Read',
  tool_call_id: 'tc-cli-1',
  attachments: [{ type: 'file', content: 'SECRET_RESPONSE_BODY' }],
};

export const STOP_FIXTURE = {
  hook_event_name: 'stop',
  conversation_id: 'conv-ide-1',
  generation_id: 'gen-42',
  cursor_version: '1.7.2',
  status: 'completed',
};

export const SUBAGENT_START_FIXTURE = {
  hook_event_name: 'subagentStart',
  conversation_id: 'conv-ide-1',
  parent_conversation_id: 'conv-ide-1',
  generation_id: 'gen-42',
  subagent_id: 'sub-9',
  subagent_type: 'explore',
  tool_call_id: 'tc-sub',
  cursor_version: '1.7.2',
};

export const FORBIDDEN_STRINGS = [
  'SECRET_PROMPT_TEXT',
  'SECRET_RESPONSE_BODY',
  'SECRET_THOUGHT_CHAIN',
  'rm -rf /tmp/secret-cmd',
  'tool_input_secret',
  'tool_output_secret',
  'file:///Users/secret/code.ts',
  'secret@example.com',
  '/Users/secret/.cursor/projects/transcript.jsonl',
  'tok_live_secret_token_value',
  '{"raw":"body"}',
];
