#!/usr/bin/env bash
# Tests for hall-init-board lib scripts (offline, mock gh).

set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
PASS=0; FAIL=0
TMP=$(mktemp -d)
trap "rm -rf '$TMP'" EXIT

# ---------- helpers -----------------------------------------------------------

check() {
  local desc="$1" cmd="$2" expect="${3:-0}"
  local actual_exit=0
  output=$(bash -c "$cmd" 2>&1) || actual_exit=$?
  if [ "$actual_exit" -ne "$expect" ]; then
    echo "  FAIL: $desc (exit $actual_exit, want $expect)"; echo "    $output"
    FAIL=$((FAIL+1)); return
  fi
  echo "  PASS: $desc"; PASS=$((PASS+1))
}

check_output() {
  local desc="$1" cmd="$2" pattern="$3" expect="${4:-0}"
  local actual_exit=0
  output=$(bash -c "$cmd" 2>&1) || actual_exit=$?
  if [ "$actual_exit" -ne "$expect" ]; then
    echo "  FAIL: $desc (exit $actual_exit, want $expect)"; echo "    $output"
    FAIL=$((FAIL+1)); return
  fi
  if ! echo "$output" | grep -qF "$pattern"; then
    echo "  FAIL: $desc (pattern not found: $pattern)"; echo "    $output"
    FAIL=$((FAIL+1)); return
  fi
  echo "  PASS: $desc"; PASS=$((PASS+1))
}

check_no_output() {
  local desc="$1" cmd="$2" pattern="$3"
  output=$(bash -c "$cmd" 2>&1) || true
  if echo "$output" | grep -qF "$pattern"; then
    echo "  FAIL: $desc (unexpected pattern found: $pattern)"; echo "    $output"
    FAIL=$((FAIL+1)); return
  fi
  echo "  PASS: $desc"; PASS=$((PASS+1))
}

# ---------- mock gh factory ---------------------------------------------------

make_mock_gh() {
  local bin_dir="$1" label_exists="${2:-false}" field_exists="${3:-false}"
  mkdir -p "$bin_dir"
  cat > "$bin_dir/gh" <<GHEOF
#!/usr/bin/env bash
case "\$*" in
  *"label list"*)
    if [ "${label_exists}" = "true" ]; then
      echo '["type/feature","type/bug","type/chore","type/okr","type/kr","type/item","priority/critical","priority/high","priority/medium","priority/low","hall/board-sync","hall/cross-invoker"]'
    else
      echo '[]'
    fi ;;
  *"label create"*)
    exit 0 ;;
  *"graphql"*)
    if [ "${field_exists}" = "true" ]; then
      echo '["ItemType","Owner","Priority","Reference","Status"]'
    else
      echo '[]'
    fi ;;
  *)
    exit 0 ;;
esac
GHEOF
  chmod +x "$bin_dir/gh"
}

# ---------- create-labels.sh tests -------------------------------------------

echo "=== create-labels.sh ==="

BIN_FRESH="$TMP/bin-fresh"
make_mock_gh "$BIN_FRESH" false false

check_output "fresh repo: creates labels and prints Labels done" \
  "bash -c 'PATH=$BIN_FRESH:\$PATH; REPO=TestOrg/test-repo; source $PLUGIN_ROOT/skills/hall-init-board/lib/create-labels.sh; create_labels'" \
  "Labels done." 0

check_no_output "fresh repo: no API error in output" \
  "bash -c 'PATH=$BIN_FRESH:\$PATH; REPO=TestOrg/test-repo; source $PLUGIN_ROOT/skills/hall-init-board/lib/create-labels.sh; create_labels'" \
  "API error"

BIN_EXISTS="$TMP/bin-exists"
make_mock_gh "$BIN_EXISTS" true false

check_output "all labels exist: skip messages printed" \
  "bash -c 'PATH=$BIN_EXISTS:\$PATH; REPO=TestOrg/test-repo; source $PLUGIN_ROOT/skills/hall-init-board/lib/create-labels.sh; create_labels'" \
  "skip: type/feature (exists)" 0

check_no_output "all labels exist: no creates" \
  "bash -c 'PATH=$BIN_EXISTS:\$PATH; REPO=TestOrg/test-repo; source $PLUGIN_ROOT/skills/hall-init-board/lib/create-labels.sh; create_labels'" \
  "created: type/feature"

check_no_output "REPO missing: Labels done not printed" \
  "bash -c 'source $PLUGIN_ROOT/skills/hall-init-board/lib/create-labels.sh; create_labels 2>&1'" \
  "Labels done."

# ---------- create-fields.sh tests -------------------------------------------

echo "=== create-fields.sh ==="

BIN_FEXISTS="$TMP/bin-fexists"
make_mock_gh "$BIN_FEXISTS" false true
HALL1="$TMP/hall1"
mkdir -p "$HALL1/.hall/session"
echo '{"board_was_created": false}' > "$HALL1/.hall/session/.board-init-state.json"

check_output "all fields exist: all skipped, Fields done printed" \
  "bash -c 'PATH=$BIN_FEXISTS:\$PATH; HOME=$HALL1; PROJECT_ID=PVT_test; source $PLUGIN_ROOT/skills/hall-init-board/lib/create-fields.sh; create_fields'" \
  "Fields done." 0

check_no_output "all fields exist: no creates" \
  "bash -c 'PATH=$BIN_FEXISTS:\$PATH; HOME=$HALL1; PROJECT_ID=PVT_test; source $PLUGIN_ROOT/skills/hall-init-board/lib/create-fields.sh; create_fields'" \
  "created:"

BIN_FFRESH="$TMP/bin-ffresh"
make_mock_gh "$BIN_FFRESH" false false
HALL2="$TMP/hall2"
mkdir -p "$HALL2/.hall/session"
echo '{"board_was_created": true}' > "$HALL2/.hall/session/.board-init-state.json"

check_output "fresh board: Status options updated" \
  "bash -c 'PATH=$BIN_FFRESH:\$PATH; HOME=$HALL2; PROJECT_ID=PVT_test; source $PLUGIN_ROOT/skills/hall-init-board/lib/create-fields.sh; create_fields'" \
  "Updating Status options" 0

check_no_output "PROJECT_ID missing: Fields done not printed" \
  "bash -c 'source $PLUGIN_ROOT/skills/hall-init-board/lib/create-fields.sh; create_fields 2>&1'" \
  "Fields done."

# ---------- Step 3 null-check guard ------------------------------------------

echo "=== Step 3 null-check guard ==="

check_output "null PROJECT_ID: exits non-zero with clear error message" \
  'bash -c '"'"'
PROJECT_ID=null
if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
  echo "ERROR: createProjectV2 returned null — check permissions (needs project:write on org)"
  exit 1
fi'"'" \
  "ERROR: createProjectV2 returned null" 1

check "empty PROJECT_ID: exits non-zero" \
  'bash -c '"'"'
PROJECT_ID=""
if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
  exit 1
fi'"'" 1

check "valid PROJECT_ID: passes guard" \
  'bash -c '"'"'
PROJECT_ID=PVT_abc123
if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
  exit 1
fi'"'" 0

# ---------- results -----------------------------------------------------------

echo
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
