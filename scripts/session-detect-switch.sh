#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:?Usage: session-detect-switch.sh <org/slug>}"
OLD_SLUG=$(cat "$HOME/.hall/session/.repo-slug" 2>/dev/null || true)
rm -f "$HOME/.hall/session/.old-slug"
if [ -n "$OLD_SLUG" ] && [ "$OLD_SLUG" != "$SLUG" ]; then
  echo "[hall-open] project switch detected: $OLD_SLUG → $SLUG"
  printf '%s' "$OLD_SLUG" > "$HOME/.hall/session/.old-slug"
fi
