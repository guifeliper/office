#!/usr/bin/env bash
# Cursor Office observer — fail-open, viewer-only.
# Usage: cursor-hook.sh <hook_event_name>
# Never logs stdin or the auth token. Always exits 0 after printing a fixed response.

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

# Missing hook name still fails open with empty object.
if [ -z "$HOOK_NAME" ]; then
  respond
fi

TOKEN_FILE="${CURSOR_OFFICE_TOKEN_FILE:-}"
PORT_FILE="${CURSOR_OFFICE_PORT_FILE:-}"
MAX_BYTES="${CURSOR_OFFICE_MAX_BYTES:-65536}"
TIMEOUT_SECS="${CURSOR_OFFICE_TIMEOUT_SECS:-1}"

# Drain/bound stdin without ever writing it to disk or stderr.
STDIN_DATA=""
if command -v head >/dev/null 2>&1; then
  # +1 byte to detect overflow; discard overflow silently.
  STDIN_DATA="$(head -c "$((MAX_BYTES + 1))" 2>/dev/null || true)"
else
  STDIN_DATA="$(dd bs="$MAX_BYTES" count=1 2>/dev/null || true)"
fi

BYTE_LEN=${#STDIN_DATA}
if [ "$BYTE_LEN" -gt "$MAX_BYTES" ]; then
  respond
fi

if [ -z "$TOKEN_FILE" ] || [ -z "$PORT_FILE" ]; then
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

# Loopback only. Auth header carries the token (not argv). Never echo body/token.
curl \
  --silent \
  --show-error \
  --max-time "$TIMEOUT_SECS" \
  --connect-timeout "$TIMEOUT_SECS" \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Cursor-Office-Hook: ${HOOK_NAME}" \
  --data-binary @- \
  "http://127.0.0.1:${PORT}/ingest" \
  >/dev/null 2>&1 \
  <<<"$STDIN_DATA" || true

respond
