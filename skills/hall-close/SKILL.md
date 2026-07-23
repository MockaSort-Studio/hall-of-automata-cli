---
name: hall-close
description: Exit Old Major session mode and clean up session files
allowed-tools: [Bash, Write, CronDelete]
---

# /hall:close

Exit Hall session mode. Cleans up session files; leaves plans and persona cache intact.

## Execution sequence

### Step 0.5: Reconcile before close

Run the reconcile procedure from `/hall:reconcile` before clearing session files. This ensures in-flight tasks have their board state updated before the session ends.

If reconcile errors: log the error and continue — do not abort close.

### Step 1: Cancel autonomous reconcile cron

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
CRON_ID=""
if [ -n "$SLUG" ] && [ -f ~/.hall/$SLUG/cron.json ]; then
  CRON_ID=$(python3 -c "import json; print(json.load(open('$HOME/.hall/$SLUG/cron.json'))['cron_id'])")
  echo "CRON_ID=${CRON_ID}"
fi
```

If `CRON_ID` is non-empty: call `CronDelete` with id=`$CRON_ID`.

```bash
rm -f ~/.hall/$SLUG/cron.json
echo "Autonomous cron cancelled."
```

### Step 2: Kill watcher daemon

```bash
if [ -f ~/.hall/watcher.pid ]; then
  PID=$(cat ~/.hall/watcher.pid)
  kill "$PID" 2>/dev/null && echo "Stopped watcher (PID $PID)." || echo "Watcher was not running."
  rm ~/.hall/watcher.pid
fi
```

### Step 3: Remove session files

```bash
if [ -n "$SLUG" ]; then
  rm -f ~/.hall/$SLUG/session/CLAUDE-stack.md
else
  rm -f ~/.hall/session/CLAUDE-stack.md
fi
rm -f ~/.hall/session/.open_mode
rm -f ~/.hall/session/.repo-slug
rm -rf ~/.hall/session/claude-agents/
echo "Session files cleaned up."
```

### Step 4: Confirm

Confirm to the user that the session is closed. Note that plans and persona cache are intact for next time.

Return to normal Claude Code operation.
