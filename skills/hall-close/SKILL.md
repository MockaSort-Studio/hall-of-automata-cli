---
name: hall-close
description: Exit Old Major session mode — cancel the autonomous cron
allowed-tools: [Bash, CronDelete]
---

# /hall:close

Exit Hall session mode. Cancels the autonomous cron. GitHub remains the source of truth for everything else, so there is nothing else to reconcile or clean up.

## Execution sequence

### Step 1: Cancel autonomous cron

```bash
REPO=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
CRON_ID=""
if [ -n "$REPO" ] && [ -f ~/.hall/$REPO/cron.json ]; then
  CRON_ID=$(python3 -c "import json; print(json.load(open('$HOME/.hall/$REPO/cron.json'))['cron_id'])")
  echo "CRON_ID=${CRON_ID}"
fi
```

If `CRON_ID` is non-empty: call `CronDelete` with id=`$CRON_ID`.

```bash
rm -f ~/.hall/$REPO/cron.json
echo "Autonomous cron cancelled."
```

### Step 2: Confirm

Confirm to the user that the session is closed. Nothing else needs cleanup — plan state lives on GitHub, and the agent index is preserved for next time.

Return to normal Claude Code operation.
