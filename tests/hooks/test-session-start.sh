#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}"
SCRIPT="$PLUGIN_ROOT/hooks/scripts/session-start.sh"
PASS=0; FAIL=0
TMP=$(mktemp -d)

run_hook() {
  local desc="$1"; local fake_home="$2"; local expect_pattern="$3"
  output=$(HOME="$fake_home" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$SCRIPT" 2>&1)
  if echo "$output" | grep -q "$expect_pattern"; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"; echo "  output: $output"; FAIL=$((FAIL + 1))
  fi
}

echo "=== session-start hook tests ==="

# Test 1: Silent when no active session (.open_mode absent)
NO_SESSION="$TMP/no-session"
mkdir -p "$NO_SESSION"
run_hook "silent when no active session" "$NO_SESSION" "^$"

# Test 2: Injects methodology JSON when session is open
WITH_SESSION="$TMP/with-session"
mkdir -p "$WITH_SESSION/.hall/session"
mkdir -p "$WITH_SESSION/.hall/test-org/test-project/session"
mkdir -p "$WITH_SESSION/.hall/personas"
echo "Old Major persona content" > "$WITH_SESSION/.hall/personas/old-major.md"
echo "running" > "$WITH_SESSION/.hall/session/.open_mode"
echo "test-org/test-project" > "$WITH_SESSION/.hall/session/.repo-slug"
printf '@%s/.hall/personas/old-major.md\n' "$WITH_SESSION" > "$WITH_SESSION/.hall/test-org/test-project/session/CLAUDE-stack.md"
run_hook "injects methodology JSON when session is open" "$WITH_SESSION" "hookSpecificOutput"

# Test 3: Silent when session open but stack missing
NO_STACK="$TMP/no-stack"
mkdir -p "$NO_STACK/.hall/session"
echo "running" > "$NO_STACK/.hall/session/.open_mode"
echo "test-org/test-project" > "$NO_STACK/.hall/session/.repo-slug"
run_hook "silent when session open but stack missing" "$NO_STACK" "^$"

rm -rf "$TMP"
echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
