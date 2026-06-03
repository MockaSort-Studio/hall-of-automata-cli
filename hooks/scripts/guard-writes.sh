#!/usr/bin/env bash
# PreToolUse hook: block writes outside allowed paths.
# Reads a JSON object from stdin with keys: tool, tool_input.
# Exits 0 to allow, 1 to block.

set -euo pipefail

INPUT=$(cat)
read -r TOOL FILE_PATH <<< "$(printf '%s' "$INPUT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(d.get('tool', ''), ti.get('file_path', ti.get('file_name', '')))")" "

# Only intercept write-type tools
case "$TOOL" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Check absolute ~/.hall/ path before normalization (realpath --relative-to=. would obscure it)
FILE_REAL=$(realpath -m "$FILE_PATH" 2>/dev/null || echo "")
HALL_REAL=$(realpath -m "$HOME/.hall" 2>/dev/null || echo "")
if [[ -n "$FILE_REAL" && -n "$HALL_REAL" && "$FILE_REAL" == "$HALL_REAL/"* ]]; then
  exit 0
fi

# Normalize: strip leading ./ and resolve .. traversals
FILE_PATH="${FILE_PATH#./}"
FILE_PATH=$(realpath -m --relative-to=. "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

# Allowed path patterns (.hall-cache/* kept as migration fallback)
allowed() {
  local p="$1"
  [[ "$p" == .hall-cache/* ]] && return 0
  [[ "$p" == .gitignore ]]     && return 0
  return 1
}

if allowed "$FILE_PATH"; then
  exit 0
fi

echo "BLOCKED: Old Major does not write to the repository. Writes are only permitted inside ~/.hall/ or .hall-cache/. Attempted path: $FILE_PATH" >&2
exit 1
