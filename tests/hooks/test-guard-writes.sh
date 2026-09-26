#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}/hooks/scripts/guard-writes.sh"
PASS=0; FAIL=0

run_hook() {
  local desc="$1" input="$2" expect_exit="$3"
  local actual_exit=0 actual
  actual=$(printf '%s' "$input" | bash "$SCRIPT" 2>&1) || actual_exit=$?
  if [ "$actual_exit" -eq "$expect_exit" ]; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (got exit $actual_exit, wanted $expect_exit)"
    echo "  output: $actual"; FAIL=$((FAIL + 1))
  fi
}

hook_input() {
  python3 -c 'import json, sys; print(json.dumps({"tool": "Write", "tool_input": {"file_path": sys.argv[1]}}))' "$1"
}

echo "=== guard-writes hook tests ==="

run_hook "blocks write to src/main.py" "$(hook_input 'src/main.py')" 1
run_hook "blocks edit to README.md" '{"tool":"Edit","tool_input":{"file_path":"README.md"}}' 1
run_hook "allows write to ~/.hall/test-org/test-repo/config.json" "$(hook_input "$HOME/.hall/test-org/test-repo/config.json")" 0
run_hook "allows write to ~/.hall/agent-index.json" "$(hook_input "$HOME/.hall/agent-index.json")" 0
run_hook "allows write to ~/.hall/.repo-slug" "$(hook_input "$HOME/.hall/.repo-slug")" 0
run_hook "allows normalized ~/.hall/ path" "$(hook_input "$HOME/.hall/test-org/../test-org/config.json")" 0
run_hook "blocks write to .gitignore" "$(hook_input '.gitignore')" 1
run_hook "blocks write to .hall-cache/" "$(hook_input '.hall-cache/config.json')" 1
run_hook "blocks path traversal outside ~/.hall/" "$(hook_input '../src/evil.py')" 1
run_hook "blocks invalid JSON" '{' 1

echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
