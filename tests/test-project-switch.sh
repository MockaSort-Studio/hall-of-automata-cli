#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}"
SCRIPT="$PLUGIN_ROOT/scripts/session-purge-project.sh"
PASS=0; FAIL=0
TMP=$(mktemp -d)

assert_absent() {
  local desc="$1"; local path="$2"
  if [ ! -e "$path" ]; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc — expected absent: $path"; FAIL=$((FAIL + 1))
  fi
}

assert_present() {
  local desc="$1"; local path="$2"
  if [ -e "$path" ]; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc — expected present: $path"; FAIL=$((FAIL + 1))
  fi
}

echo "=== project switch / session purge tests ==="

# Seed project-a with session layer, plans, and context
HALL_HOME="$TMP/home"
mkdir -p "$HALL_HOME/.hall/projects/project-a/session"
mkdir -p "$HALL_HOME/.hall/projects/project-a/plans"
mkdir -p "$HALL_HOME/.hall/session"
echo "stale stack" > "$HALL_HOME/.hall/projects/project-a/session/CLAUDE-stack.md"
echo "stale roster" > "$HALL_HOME/.hall/projects/project-a/session/roster-index.md"
echo "plan-data" > "$HALL_HOME/.hall/projects/project-a/plans/sprint-1.json"
echo "project context" > "$HALL_HOME/.hall/projects/project-a/context.md"
echo "project-a" > "$HALL_HOME/.hall/session/.repo-slug"

# Test 1: purge removes the session directory for the old slug
HOME="$HALL_HOME" bash "$SCRIPT" "project-a"
assert_absent "session/CLAUDE-stack.md removed on switch" \
  "$HALL_HOME/.hall/projects/project-a/session/CLAUDE-stack.md"
assert_absent "session/roster-index.md removed on switch" \
  "$HALL_HOME/.hall/projects/project-a/session/roster-index.md"

# Test 2: plans/ and context.md are not touched
assert_present "plans/ preserved after switch" \
  "$HALL_HOME/.hall/projects/project-a/plans/sprint-1.json"
assert_present "context.md preserved after switch" \
  "$HALL_HOME/.hall/projects/project-a/context.md"

# Test 3: purge is idempotent when session dir is already absent
rm -rf "$HALL_HOME/.hall/projects/project-a/session"
if HOME="$HALL_HOME" bash "$SCRIPT" "project-a" &>/dev/null; then
  echo "  PASS: purge is idempotent when session dir absent"; PASS=$((PASS + 1))
else
  echo "  FAIL: purge failed when session dir absent"; FAIL=$((FAIL + 1))
fi

rm -rf "$TMP"
echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
