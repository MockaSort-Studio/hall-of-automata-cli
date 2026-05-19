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

rm -rf "$TMP"
echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
