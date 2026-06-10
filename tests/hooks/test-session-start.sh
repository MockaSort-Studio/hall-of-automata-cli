#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}/hooks/scripts/session-start.sh"
PASS=0; FAIL=0
TMP=$(mktemp -d)

run_hook() {
  local desc="$1"; local fake_home="$2"; local expect_pattern="$3"
  output=$(HOME="$fake_home" bash "$SCRIPT" 2>&1)
  if echo "$output" | grep -q "$expect_pattern"; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"; echo "  output: $output"; FAIL=$((FAIL + 1))
  fi
}

echo "=== session-start hook tests ==="

# No session active — hook should be silent
NO_SESSION="$TMP/no-session"
mkdir -p "$NO_SESSION"
run_hook "silent when no active session" "$NO_SESSION" "^$"

# Active session detected — hook should print resume prompt
WITH_SESSION="$TMP/with-session"
mkdir -p "$WITH_SESSION/.hall/session"
touch "$WITH_SESSION/.hall/session/CLAUDE-stack.md"
run_hook "resume prompt when session stack exists" "$WITH_SESSION" "interrupted Old Major session"

rm -rf "$TMP"
echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
