#!/usr/bin/env bash
set -euo pipefail

OLD_SLUG="${1:?Usage: session-purge-project.sh <old-slug>}"
SESSION_DIR="$HOME/.hall/projects/$OLD_SLUG/session"

if [ -d "$SESSION_DIR" ]; then
  rm -rf "$SESSION_DIR"
  echo "[hall-open] cleared session layer: $OLD_SLUG"
fi
