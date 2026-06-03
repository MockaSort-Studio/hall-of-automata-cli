#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}/hooks/scripts/skill-guard.sh"
WORK_DIR=$(mktemp -d)
PASS=0; FAIL=0

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

run_test() {
  local desc="$1"; local expect_exit="$2"; shift 2
  local actual_exit=0
  local actual
  actual=$(cd "$WORK_DIR" && env HOME="$WORK_DIR" "$@" bash "$SCRIPT" 2>&1) || actual_exit=$?
  if [ "$actual_exit" -eq "$expect_exit" ]; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (got exit $actual_exit, wanted $expect_exit)"; echo "  output: $actual"; FAIL=$((FAIL + 1))
  fi
}

echo "=== skill-guard hook tests ==="

# (c) No .open_mode present — pass through regardless of skill name
run_test "passes through when .open_mode is absent" 0 \
  CLAUDE_TOOL_INPUT='{"skill":"superpowers:deep-research"}'

# (d) No .open_mode present, no skill field — pass through
run_test "passes through when no skill field and .open_mode absent" 0 \
  CLAUDE_TOOL_INPUT='{"other":"value"}'

# Activate session by writing .open_mode
mkdir -p "$WORK_DIR/.hall/session"
echo "first_open" > "$WORK_DIR/.hall/session/.open_mode"

# (a) Session active — non-Hall skill is blocked
run_test "blocks non-Hall skill when .open_mode exists" 1 \
  CLAUDE_TOOL_INPUT='{"skill":"superpowers:deep-research"}'

# (b) Session active — hall-of-automata-cli:* skill is allowed
run_test "allows hall-of-automata-cli:* skill when .open_mode exists" 0 \
  CLAUDE_TOOL_INPUT='{"skill":"hall-of-automata-cli:open"}'

# (d) Session active, no skill field — pass through
run_test "passes through when .open_mode exists but no skill field" 0 \
  CLAUDE_TOOL_INPUT='{}'

echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
