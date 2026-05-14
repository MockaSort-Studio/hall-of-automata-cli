#!/usr/bin/env bash
# PreToolUse hook: block writes outside allowed paths.
# Reads a JSON object from stdin with keys: tool, tool_input.
# Exits 0 to allow, 1 to block.

set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool',''))")

# Only intercept write-type tools
case "$TOOL" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

FILE_PATH=$(echo "$INPUT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('file_path', ti.get('file_name', '')))")

# Normalize: strip leading ./
FILE_PATH="${FILE_PATH#./}"

# Allowed path patterns
allowed() {
  local p="$1"
  [[ "$p" == .hall-cache/* ]] && return 0
  [[ "$p" == .gitignore ]]     && return 0
  return 1
}

if allowed "$FILE_PATH"; then
  exit 0
fi

echo "BLOCKED: Old Major does not write to the repository. Writes are only permitted inside .hall-cache/. Attempted path: $FILE_PATH" >&2
exit 1
