---
name: hall-open-session-setup
description: Session setup — methodology overlays, cron restart, board context, watcher; executed from hall-open Step 3
---

# Session Setup

Execute only from hall-open Step 3. Runs setup.py, restarts cron if in-flight tasks exist, loads board context, starts watcher.

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/hall-open-setup.py"
```

**Cron restart (resume with in-flight tasks):**

```bash
python3 << 'PYEOF'
import json, glob, os, sys
found = any(
    any(t.get('status') in ('DISPATCHED', 'IN_PROGRESS') for t in json.load(open(f)).get('tasks', []))
    for f in glob.glob(os.path.expanduser('~/.hall/plans/*/plan.json'))
)
sys.exit(0 if found else 1)
PYEOF
&& INFLIGHT=true || INFLIGHT=false
CRON_EXISTS=$([ -f ~/.hall/session/cron.json ] && echo true || echo false)
echo "INFLIGHT=$INFLIGHT | CRON_EXISTS=$CRON_EXISTS"
```

If `INFLIGHT=true` and `CRON_EXISTS=false`: call `CronCreate` with `schedule=*/15 * * * *` and `prompt="Autonomous plan advancement (cron): drain ~/.hall/watcher-events.jsonl then run /hall:reconcile. If any task has needs_review: true after reconcile, run /hall:review. If newly unlocked READY tasks exist, dispatch them without confirmation. Append one-line summary to ~/.hall/cron-log.md."` Then write the returned cron ID:

```python
import json, os
from datetime import datetime, timezone
cron_id = "<returned cron ID>"
json.dump(
    {"cron_id": cron_id, "created_at": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    open(os.path.expanduser('~/.hall/session/cron.json'), 'w')
)
print('Cron restarted (in-flight tasks detected).')
```

**Board context:** Read `board_project_number` from `~/.hall/session/config.json`. If absent, skip silently.

```bash
BOARD_NUM=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/config.json'))).get('board_project_number',''))" 2>/dev/null || echo "")
OWNER=$(echo "$REPO" | cut -d/ -f1)
```

If `BOARD_NUM` is non-empty: call `read_board` MCP with `owner=$OWNER` and `project_number=$BOARD_NUM` (integer). On success, format `board-context.md`:

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/format-board-context.py"
```

On error from `read_board`: print `"Board context unavailable (board not provisioned)."` and continue.

```bash
# Ensure board-context.md always exists for CLAUDE-stack @-import
[ -f ~/.hall/session/board-context.md ] \
  || printf '# Board Context\nNot provisioned.\n' > ~/.hall/session/board-context.md
```

```bash
# Watcher
WPID=$(cat ~/.hall/watcher.pid 2>/dev/null || echo "")
if [ -n "$WPID" ] && ps -p "$WPID" -o comm= 2>/dev/null | grep -q watcher; then
  echo "Watcher OK (PID $WPID)."
else
  nohup bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/watcher.sh" &> ~/.hall/watcher.log &
  echo "Watcher started."
fi
```

// Snowball 🐷 — session setup now has its own room; SKILL.md can breathe
