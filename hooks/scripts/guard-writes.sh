#!/usr/bin/env bash
# PreToolUse hook: block writes outside ~/.hall/.
# Reads a JSON object from stdin with keys: tool, tool_input.
# Exits 0 to allow, 1 to block.

set -euo pipefail

python3 -c '
import json
import os
import sys

try:
    event = json.load(sys.stdin)
except json.JSONDecodeError as error:
    print(f"BLOCKED: invalid hook input: {error}", file=sys.stderr)
    sys.exit(1)

if event.get("tool") not in {"Write", "Edit", "MultiEdit"}:
    sys.exit(0)

input_data = event.get("tool_input", {})
path = input_data.get("file_path", input_data.get("file_name", ""))
hall = os.path.realpath(os.path.expanduser("~/.hall"))
target = os.path.realpath(os.path.expanduser(path))

try:
    allowed = os.path.commonpath([hall, target]) == hall and target != hall
except ValueError:
    allowed = False

if allowed:
    sys.exit(0)

display_path = path[2:] if path.startswith("./") else path
print(
    "BLOCKED: Old Major does not write to the repository. "
    f"Writes are only permitted inside ~/.hall/. Attempted path: {display_path}",
    file=sys.stderr,
)
sys.exit(1)
'