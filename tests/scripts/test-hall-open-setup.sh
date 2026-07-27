#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="$PLUGIN_ROOT/scripts/hall-open-setup.py"
PASS=0; FAIL=0
TMP=$(mktemp -d)
trap "rm -rf '$TMP'" EXIT

run_test() {
  local desc="$1" home="$2" pattern="$3" expect_exit="${4:-0}"
  local actual_exit=0
  output=$(HOME="$home" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" \
    python3 "$SCRIPT" 2>&1) || actual_exit=$?
  if [ "$actual_exit" -ne "$expect_exit" ]; then
    echo "  FAIL: $desc (exit $actual_exit, want $expect_exit)"; echo "    $output"; FAIL=$((FAIL+1)); return
  fi
  if [ -n "$pattern" ] && ! echo "$output" | grep -qF "$pattern"; then
    echo "  FAIL: $desc (pattern not found: $pattern)"; echo "    $output"; FAIL=$((FAIL+1)); return
  fi
  echo "  PASS: $desc"; PASS=$((PASS+1))
}

echo "=== hall-open-setup project init tests ==="

# Scenario 1: .repo-slug present, no project dir yet — creates it and initializes config.json
FRESH_HOME="$TMP/home-fresh"
mkdir -p "$FRESH_HOME/.hall"
echo "TestOrg/fresh-repo" > "$FRESH_HOME/.hall/.repo-slug"
run_test "fresh project: initializes config.json" "$FRESH_HOME" \
  "Initialized project: TestOrg/fresh-repo" 0
if [ -f "$FRESH_HOME/.hall/TestOrg/fresh-repo/config.json" ]; then
  echo "  PASS: config.json created"; PASS=$((PASS+1))
else
  echo "  FAIL: config.json not created"; FAIL=$((FAIL+1))
fi

# Scenario 2: .repo-slug present, project dir + config.json already exist — leaves config.json untouched
EXISTING_HOME="$TMP/home-existing"
mkdir -p "$EXISTING_HOME/.hall/TestOrg/existing-repo"
echo "TestOrg/existing-repo" > "$EXISTING_HOME/.hall/.repo-slug"
echo '{"automation_level": 1}' > "$EXISTING_HOME/.hall/TestOrg/existing-repo/config.json"
run_test "existing project: does not reinitialize config.json" "$EXISTING_HOME" \
  "Using project: TestOrg/existing-repo" 0
if grep -q "automation_level" "$EXISTING_HOME/.hall/TestOrg/existing-repo/config.json"; then
  echo "  PASS: existing config.json preserved"; PASS=$((PASS+1))
else
  echo "  FAIL: existing config.json was overwritten"; FAIL=$((FAIL+1))
fi

# Scenario 3: no .repo-slug at all — hall-open Step 1 always resolves it first, so this is an error case
NO_SLUG_HOME="$TMP/home-no-slug"
mkdir -p "$NO_SLUG_HOME/.hall"
run_test "no .repo-slug: fails loudly rather than silently no-oping" "$NO_SLUG_HOME" \
  "" 1

echo
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
