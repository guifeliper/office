#!/usr/bin/env bash
# Cursor Office observer — fail-open, viewer-only.
# Usage: cursor-hook.sh <hook_event_name>
# Discovers ingest.token / ingest.port next to this staged script (Cursor does not
# inherit Electron env). Never logs stdin or the auth token. Always exits 0 after
# printing a fixed response selected from the hook name.

set -u

HOOK_NAME="${1:-}"

respond() {
  case "$HOOK_NAME" in
    preToolUse|subagentStart)
      printf '%s\n' '{"permission":"allow"}'
      ;;
    beforeSubmitPrompt)
      printf '%s\n' '{"continue":true}'
      ;;
    *)
      printf '%s\n' '{}'
      ;;
  esac
  exit 0
}

if [ -z "$HOOK_NAME" ]; then
  respond
fi

# Resolve secrets relative to the staged wrapper so Cursor-spawned processes work
# without Electron-injected environment variables. Env overrides remain for tests.
DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="${CURSOR_OFFICE_TOKEN_FILE:-$DIR/ingest.token}"
PORT_FILE="${CURSOR_OFFICE_PORT_FILE:-$DIR/ingest.port}"
MAX_BYTES="${CURSOR_OFFICE_MAX_BYTES:-65536}"
TIMEOUT_SECS="${CURSOR_OFFICE_TIMEOUT_SECS:-1}"

# Bound stdin in memory only — never redirect through a here-string (bash 3.2
# materializes here-strings as temp files on disk).
STDIN_DATA=""
if command -v head >/dev/null 2>&1; then
  STDIN_DATA="$(head -c "$((MAX_BYTES + 1))" 2>/dev/null || true)"
else
  STDIN_DATA="$(dd bs="$MAX_BYTES" count=1 2>/dev/null || true)"
fi

BYTE_LEN=${#STDIN_DATA}
if [ "$BYTE_LEN" -gt "$MAX_BYTES" ]; then
  respond
fi

if [ ! -r "$TOKEN_FILE" ] || [ ! -r "$PORT_FILE" ]; then
  respond
fi

TOKEN="$(cat "$TOKEN_FILE" 2>/dev/null || true)"
PORT="$(cat "$PORT_FILE" 2>/dev/null || true)"

if [ -z "$TOKEN" ] || [ -z "$PORT" ]; then
  respond
fi

# Auth header via process substitution so the Bearer token never appears in argv.
# Body via pipe (Fifo) into --data-binary @- — not a here-string temp file.
printf '%s' "$STDIN_DATA" | curl \
  --silent \
  --show-error \
  --max-time "$TIMEOUT_SECS" \
  --connect-timeout "$TIMEOUT_SECS" \
  -X POST \
  -H @<(printf 'Authorization: Bearer %s\n' "$TOKEN") \
  -H "Content-Type: application/json" \
  -H "X-Cursor-Office-Hook: ${HOOK_NAME}" \
  --data-binary @- \
  "http://127.0.0.1:${PORT}/ingest" \
  >/dev/null 2>&1 || true

respond
