#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="$PLUGIN_ROOT/scripts/hall-open-setup.py"
PASS=0; FAIL=0
TMP=$(mktemp -d)
trap "rm -rf '$TMP'" EXIT

make_hall_home() {
  local h="$1"
  mkdir -p "$h/.hall/session" "$h/.hall/personas"
  echo "test-sha" > "$h/.hall/session/.current-sha"
  echo "test-sha" > "$h/.hall/session/.invariant-built"
  echo "[]" > "$h/.hall/personas/.advisory-roster.json"
}

run_test() {
  local desc="$1" dir="$2" home="$3" pattern="$4" expect_exit="${5:-0}"
  local actual_exit=0
  output=$(cd "$dir" && HOME="$home" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" \
    python3 "$SCRIPT" 2>&1) || actual_exit=$?
  if [ "$actual_exit" -ne "$expect_exit" ]; then
    echo "  FAIL: $desc (exit $actual_exit, want $expect_exit)"; echo "    $output"; FAIL=$((FAIL+1)); return
  fi
  if [ -n "$pattern" ] && ! echo "$output" | grep -qF "$pattern"; then
    echo "  FAIL: $desc (pattern not found: $pattern)"; echo "    $output"; FAIL=$((FAIL+1)); return
  fi
  echo "  PASS: $desc"; PASS=$((PASS+1))
}

echo "=== hall-open-setup slug derivation tests ==="

# Scenario 1: no config, git remote present — git is not consulted; no-project mode
GIT_DIR="$TMP/git-repo"
mkdir -p "$GIT_DIR"
git -C "$GIT_DIR" init -q
git -C "$GIT_DIR" remote add origin "https://github.com/TestOrg/my-project.git"
GIT_HOME="$TMP/home-git"
make_hall_home "$GIT_HOME"
run_test "no config, git present: no-project mode (git unused)" "$GIT_DIR" "$GIT_HOME" \
  "project layer — no project" 0

# Scenario 2: no config, no git — no-project mode
BARE_DIR="$TMP/bare-dir"
mkdir -p "$BARE_DIR"
BARE_HOME="$TMP/home-bare"
make_hall_home "$BARE_HOME"
run_test "no config, no git: no-project mode" "$BARE_DIR" "$BARE_HOME" \
  "project layer — no project" 0

# Scenario 3: slug from config — reads target_repo, prints config message, writes .repo-slug
NO_GIT_DIR="$TMP/no-git"
mkdir -p "$NO_GIT_DIR"
CFG_HOME="$TMP/home-cfg"
make_hall_home "$CFG_HOME"
echo '{"target_repo":"TestOrg/config-repo"}' > "$CFG_HOME/.hall/.config.json"
run_test "slug from config: prints config message" "$NO_GIT_DIR" "$CFG_HOME" \
  "Using project from ~/.hall/.config.json: config-repo" 0
if grep -q "TestOrg/config-repo" "$CFG_HOME/.hall/session/.repo-slug" 2>/dev/null; then
  echo "  PASS: .repo-slug written as org/slug from config"; PASS=$((PASS+1))
else
  echo "  FAIL: .repo-slug not written as org/slug from config"; FAIL=$((FAIL+1))
fi

# Scenario 4: config slug overrides stale .repo-slug
DIFF_DIR="$TMP/diff-repo"
mkdir -p "$DIFF_DIR"
DIFF_HOME="$TMP/home-diff"
make_hall_home "$DIFF_HOME"
echo '{"target_repo":"TestOrg/new-project"}' > "$DIFF_HOME/.hall/.config.json"
echo "old-project" > "$DIFF_HOME/.hall/session/.repo-slug"
run_test "config slug overrides stale .repo-slug" "$DIFF_DIR" "$DIFF_HOME" \
  "project layer — new-project" 0
if grep -q "TestOrg/new-project" "$DIFF_HOME/.hall/session/.repo-slug" 2>/dev/null; then
  echo "  PASS: .repo-slug updated to TestOrg/new-project"; PASS=$((PASS+1))
else
  echo "  FAIL: .repo-slug not updated to org/slug"; FAIL=$((FAIL+1))
fi

echo
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
