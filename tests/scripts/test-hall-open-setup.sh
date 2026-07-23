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

# Scenario 1: no .repo-slug, git remote present — git is not consulted; no-project mode
GIT_DIR="$TMP/git-repo"
mkdir -p "$GIT_DIR"
git -C "$GIT_DIR" init -q
git -C "$GIT_DIR" remote add origin "https://github.com/TestOrg/my-project.git"
GIT_HOME="$TMP/home-git"
make_hall_home "$GIT_HOME"
run_test "no .repo-slug, git present: no-project mode (git unused)" "$GIT_DIR" "$GIT_HOME" \
  "Setup complete" 0

# Scenario 2: no .repo-slug, no git — no-project mode
BARE_DIR="$TMP/bare-dir"
mkdir -p "$BARE_DIR"
BARE_HOME="$TMP/home-bare"
make_hall_home "$BARE_HOME"
run_test "no .repo-slug, no git: no-project mode" "$BARE_DIR" "$BARE_HOME" \
  "Setup complete" 0

# Scenario 3: .repo-slug present — reads it, prints project message, preserves file
NO_GIT_DIR="$TMP/no-git"
mkdir -p "$NO_GIT_DIR"
CFG_HOME="$TMP/home-cfg"
make_hall_home "$CFG_HOME"
echo "TestOrg/config-repo" > "$CFG_HOME/.hall/session/.repo-slug"
run_test "slug from .repo-slug: prints project message" "$NO_GIT_DIR" "$CFG_HOME" \
  "Using project: config-repo" 0
if grep -q "TestOrg/config-repo" "$CFG_HOME/.hall/session/.repo-slug" 2>/dev/null; then
  echo "  PASS: .repo-slug preserved after setup"; PASS=$((PASS+1))
else
  echo "  FAIL: .repo-slug not preserved after setup"; FAIL=$((FAIL+1))
fi

# Scenario 4: legacy .config.json not consulted — absent .repo-slug → no-project mode
DIFF_DIR="$TMP/diff-repo"
mkdir -p "$DIFF_DIR"
DIFF_HOME="$TMP/home-diff"
make_hall_home "$DIFF_HOME"
echo '{"target_repo":"TestOrg/new-project"}' > "$DIFF_HOME/.hall/.config.json"
run_test "legacy .config.json not consulted: no .repo-slug → no-project mode" "$DIFF_DIR" "$DIFF_HOME" \
  "Setup complete" 0

echo
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
