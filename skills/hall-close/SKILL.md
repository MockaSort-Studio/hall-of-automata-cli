---
name: hall-close
description: Exit Old Major session mode and clean up session files
allowed-tools: [Bash, Write, CronDelete]
---

# /hall:close

Exit Hall session mode. Cleans up session files; leaves plans and persona cache intact.

## Execution sequence

### Step 1: Remove CLAUDE.md (or import line)

```bash
IMPORT_LINE="@.hall-cache/session/CLAUDE-stack.md"

if [ -f CLAUDE.md ]; then
  content=$(cat CLAUDE.md)
  if [ "$content" = "$IMPORT_LINE" ]; then
    # File was created by /hall:open — remove it entirely
    rm CLAUDE.md
    echo "Removed session CLAUDE.md."
  else
    # File has pre-existing content — remove only the import line
    grep -v "$IMPORT_LINE" CLAUDE.md > CLAUDE.md.tmp && mv CLAUDE.md.tmp CLAUDE.md
    echo "Removed Hall stack import line from CLAUDE.md."
  fi
fi
```

### Step 1.5: Cancel autonomous reconcile cron

```bash
CRON_ID=""
if [ -f .hall-cache/session/cron.json ]; then
  CRON_ID=$(python3 -c "import json; print(json.load(open('.hall-cache/session/cron.json'))['cron_id'])")
  echo "CRON_ID=${CRON_ID}"
fi
```

If `CRON_ID` is non-empty: call `CronDelete` with id=`$CRON_ID`.

```bash
rm -f .hall-cache/session/cron.json
echo "Autonomous cron cancelled."
```

### Step 2: Kill watcher daemon

```bash
if [ -f .hall-cache/watcher.pid ]; then
  PID=$(cat .hall-cache/watcher.pid)
  kill "$PID" 2>/dev/null && echo "Stopped watcher (PID $PID)." || echo "Watcher was not running."
  rm .hall-cache/watcher.pid
fi
```

### Step 3: Remove session files

```bash
rm -f .hall-cache/session/CLAUDE-stack.md
rm -rf .hall-cache/session/claude-agents/
echo "Session files cleaned up."
```

### Step 4: Confirm

Confirm to the user that the session is closed. Note that plans and persona cache are intact for next time.

Return to normal Claude Code operation.
