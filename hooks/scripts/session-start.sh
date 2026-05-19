#!/usr/bin/env bash
# SessionStart hook: detect interrupted sessions and gitignore state.
set -euo pipefail

STACK=".hall-cache/session/CLAUDE-stack.md"
GITIGNORE=".gitignore"

if [ -f "$STACK" ]; then
  # Warn if .hall-cache/ is not in .gitignore
  if [ ! -f "$GITIGNORE" ] || ! grep -q "\.hall-cache" "$GITIGNORE" 2>/dev/null; then
    echo "WARNING: .hall-cache/ is not in .gitignore. Run /hall:open to fix this, or add it manually." >&2
  fi
  echo "NOTE: An interrupted Old Major session was detected (.hall-cache/session/CLAUDE-stack.md exists). Run /hall:open to resume it, or /hall:close to clean it up." >&2
fi
