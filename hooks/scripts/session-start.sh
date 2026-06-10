#!/usr/bin/env bash
# SessionStart hook: inject Old Major methodology via additionalContext.
set -euo pipefail

HALL="$HOME/.hall"

# 1. No active session — exit silently.
if [ ! -f "$HALL/session/.open_mode" ]; then
  exit 0
fi

# 2. Resolve slug.
SLUG=""
if [ -f "$HALL/session/.repo-slug" ]; then
  SLUG=$(cat "$HALL/session/.repo-slug")
fi

# 3. Resolve stack path.
if [ -n "$SLUG" ]; then
  STACK="$HALL/projects/$SLUG/session/CLAUDE-stack.md"
else
  STACK="$HALL/session/CLAUDE-stack.md"
fi

# 4. Stack missing — session opened but stack not yet assembled.
if [ ! -f "$STACK" ]; then
  exit 0
fi

# 5. Parse @-imports and concatenate file contents.
CONTENT=""
while IFS= read -r line; do
  if [[ "$line" == @* ]]; then
    target="${line:1}"
    if [ -f "$target" ]; then
      file_content=$(cat "$target")
      if [ -n "$CONTENT" ]; then
        CONTENT="${CONTENT}"
"${file_content}"
      else
        CONTENT="$file_content"
      fi
    else
      echo "session-start: @-import target missing: $target" >&2
    fi
  fi
done < "$STACK"

# 6 & 7. JSON-escape and emit hookSpecificOutput.
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -z "${COPILOT_CLI:-}" ]; then
  escaped="${CONTENT//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  escaped="${escaped//$'\n'/\\n}"
  escaped="${escaped//$'\r'/\\r}"
  escaped="${escaped//$'\t'/\\t}"
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$escaped"
fi

exit 0
