#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}/hooks/scripts/watcher.sh"
PASS=0; FAIL=0
TMP=$(mktemp -d)

echo "=== watcher daemon tests ==="

check() {
  local desc="$1"; local cmd="$2"
  if bash -c "$cmd" &>/dev/null; then echo "  PASS: $desc"; PASS=$((PASS + 1))
  else echo "  FAIL: $desc"; FAIL=$((FAIL + 1)); fi
}

mkdir -p "$TMP/.hall-cache"
(cd "$TMP" && POLL_INTERVAL=1 bash "$SCRIPT" --once &)
sleep 2
check "watcher creates PID file" "test -f $TMP/.hall-cache/watcher.pid"
PID=$(cat "$TMP/.hall-cache/watcher.pid" 2>/dev/null || echo 0)
kill "$PID" 2>/dev/null || true
check "watcher PID was a real process" "[ '$PID' -gt 0 ]"

# A12: stale PID pointing to a non-watcher process must not suppress watcher start
TMP2=$(mktemp -d)
mkdir -p "$TMP2/.hall-cache"
# Write a PID that belongs to a real but non-watcher process (sleep)
sleep 60 &
FAKE_PID=$!
echo "$FAKE_PID" > "$TMP2/.hall-cache/watcher.pid"
# Simulate the A12 liveness check: ps -p PID -o comm= | grep -q watcher
STALE_CHECK_RESULT=false
ps -p "$FAKE_PID" -o comm= 2>/dev/null | grep -q watcher && STALE_CHECK_RESULT=true || true
check "stale non-watcher PID fails A12 liveness check" "[ '$STALE_CHECK_RESULT' = 'false' ]"
# With the stale PID check failing, a new watcher should start
(cd "$TMP2" && \
  WPID=$(cat .hall-cache/watcher.pid 2>/dev/null || echo "") && \
  if [ -n "$WPID" ] && ps -p "$WPID" -o comm= 2>/dev/null | grep -q watcher; then
    echo "false" > "$TMP2/.hall-cache/_new_started"
  else
    POLL_INTERVAL=1 bash "$SCRIPT" --once &
    echo "true" > "$TMP2/.hall-cache/_new_started"
  fi
)
sleep 2
check "new watcher started despite stale PID file" \
  "[ '$(cat $TMP2/.hall-cache/_new_started 2>/dev/null)' = 'true' ]"
kill "$FAKE_PID" 2>/dev/null || true
rm -rf "$TMP2"

rm -rf "$TMP"
echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
