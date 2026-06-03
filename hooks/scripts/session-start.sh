#!/usr/bin/env bash
# SessionStart hook: detect interrupted sessions.
set -euo pipefail

STACK="$HOME/.hall/session/CLAUDE-stack.md"

if [ -f "$STACK" ]; then
  echo "NOTE: An interrupted Old Major session was detected (~/.hall/session/CLAUDE-stack.md exists). Run /hall:open to resume it, or /hall:close to clean it up." >&2
fi
