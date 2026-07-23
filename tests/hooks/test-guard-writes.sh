#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}/hooks/scripts/guard-writes.sh"
PASS=0; FAIL=0

run_hook() {
  local desc="$1"; local input="$2"; local expect_exit="$3"
  actual_exit=0
  actual=$(echo "$input" | bash "$SCRIPT" 2>&1) || actual_exit=$?
  if [ "$actual_exit" -eq "$expect_exit" ]; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (got exit $actual_exit, wanted $expect_exit)"; echo "  output: $actual"; FAIL=$((FAIL + 1))
  fi
}

echo "=== guard-writes hook tests ==="

# Should BLOCK writes to arbitrary repo paths
run_hook "blocks write to src/main.py" \
  '{"tool":"Write","tool_input":{"file_path":"src/main.py","content":"code"}}' 1

run_hook "blocks edit to README.md" \
  '{"tool":"Edit","tool_input":{"file_path":"README.md","old_string":"a","new_string":"b"}}' 1

# Should ALLOW writes inside ~/.hall/ (absolute-path check fires before normalization)
run_hook "allows write to ~/.hall/test-org/test-repo/plans/" \
  '{"tool":"Write","tool_input":{"file_path":"'"$HOME"'/.hall/test-org/test-repo/plans/2026-05-14-test/plan.md","content":"# Plan"}}' 0

run_hook "allows write to ~/.hall/test-org/test-project/session/" \
  '{"tool":"Write","tool_input":{"file_path":"'"$HOME"'/.hall/test-org/test-project/session/CLAUDE-stack.md","content":"stack"}}' 0

run_hook "allows write to ~/.hall/personas/" \
  '{"tool":"Write","tool_input":{"file_path":"'"$HOME"'/.hall/personas/old-major.md","content":"persona"}}' 0

# Explicit test: absolute path that would normalise to ../../.hall/... must still be allowed
run_hook "allows absolute ~/.hall/ path (pre-normalization check)" \
  '{"tool":"Write","tool_input":{"file_path":"'"$(realpath -m "$HOME/.hall/session/config.json")"'","content":"cfg"}}' 0

# Should ALLOW writes to .gitignore (initial setup)
run_hook "allows write to .gitignore" \
  '{"tool":"Write","tool_input":{"file_path":".gitignore","content":".hall-cache/"}}' 0

# Migration fallback: .hall-cache/* still permitted
run_hook "allows write to .hall-cache/ (migration fallback)" \
  '{"tool":"Write","tool_input":{"file_path":".hall-cache/session/CLAUDE-stack.md","content":"stack"}}' 0

# Should BLOCK path traversal attempts
run_hook "blocks path traversal via .hall-cache/../src" \
  '{"tool":"Write","tool_input":{"file_path":".hall-cache/../src/evil.py","content":"pwned"}}' 1

echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
