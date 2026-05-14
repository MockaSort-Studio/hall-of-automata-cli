#!/usr/bin/env bash
# Background GitHub polling daemon for in-flight Hall tasks.
# Writes .hall-cache/watcher.pid on start.
# Polls every POLL_INTERVAL seconds (default 120).
# Pass --once to run a single check and exit (useful for testing).

set -euo pipefail

POLL_INTERVAL="${POLL_INTERVAL:-120}"
ONCE=false
[[ "${1:-}" == "--once" ]] && ONCE=true

CACHE=".hall-cache"
PID_FILE="$CACHE/watcher.pid"
PLAN_DIR=$(ls -d "$CACHE/plans/"*/ 2>/dev/null | sort | tail -1 || echo "")

# Write PID file
echo $$ > "$PID_FILE"
# In daemon mode, clean up PID file on exit; in --once mode leave it for callers to inspect
$ONCE || trap 'rm -f "$PID_FILE"' EXIT

check_once() {
  [ -z "$PLAN_DIR" ] && return
  PLAN_JSON="$PLAN_DIR/plan.json"
  [ -f "$PLAN_JSON" ] || return

  REPO=$(python3 -c "import json; d=json.load(open('$PLAN_JSON')); print(d['repo'])" 2>/dev/null || echo "")
  [ -z "$REPO" ] && return

  # Check each dispatched or in-progress task
  python3 << PYEOF
import json, subprocess, sys

with open('$PLAN_JSON') as f:
    plan = json.load(f)

events = []
for task in plan.get('tasks', []):
    if task.get('status') not in ('DISPATCHED', 'IN_PROGRESS', 'AWAITING_INPUT'):
        continue
    issue = task.get('github_issue')
    if not issue:
        continue
    try:
        result = subprocess.run(
            ['gh', 'issue', 'view', str(issue), '--repo', '$REPO',
             '--json', 'state,labels,title,url'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            continue
        data = json.loads(result.stdout)
        labels = [l['name'] for l in data.get('labels', [])]
        if 'hall:awaiting-input' in labels and task['status'] != 'AWAITING_INPUT':
            events.append(f"AWAITING_INPUT: Issue #{issue} ({task['title']}) needs your input.")
        if data['state'] == 'closed' and task['status'] not in ('MERGED', 'FAILED'):
            events.append(f"CLOSED: Issue #{issue} ({task['title']}) was closed.")
        if 'hall:post-mortem' in labels:
            events.append(f"FAILED: Issue #{issue} ({task['title']}) triggered post-mortem.")
    except Exception:
        pass

for e in events:
    print(e)
PYEOF
}

if $ONCE; then
  check_once
  exit 0
fi

while true; do
  check_once 2>/dev/null || true
  sleep "$POLL_INTERVAL"
done
