---
name: hall-open-session-setup
description: Session setup — project directory, cron restart; executed from hall-open Step 3
---

# Session Setup

Execute only from hall-open Step 3. Ensures the project directory exists and restarts cron if in-flight tasks exist.

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/hall-open-setup.py"
```

**Cron restart (resume with in-flight tasks):**

```bash
REPO=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
INFLIGHT=$(gh issue list --repo "$REPO" --state open \
  --json labels \
  --jq '[.[] | select(.labels | any(.name | startswith("hall:")))] | length > 0' \
  2>/dev/null || echo "false")
CRON_EXISTS=$([ -f ~/.hall/$REPO/cron.json ] && echo true || echo false)
echo "INFLIGHT=$INFLIGHT | CRON_EXISTS=$CRON_EXISTS"
```

If `INFLIGHT=true` and `CRON_EXISTS=false`: call `CronCreate` with `schedule=*/15 * * * *` and `prompt="Autonomous plan advancement (cron): run /hall:review. If newly unlocked READY tasks exist, dispatch them without confirmation. Append one-line summary to ~/.hall/cron-log.md."` Then write the returned cron ID:

```python
import json, os
from datetime import datetime, timezone
repo = open(os.path.expanduser('~/.hall/.repo-slug')).read().strip()
cron_id = "<returned cron ID>"
json.dump(
    {"cron_id": cron_id, "created_at": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    open(os.path.expanduser(f'~/.hall/{repo}/cron.json'), 'w')
)
print('Cron restarted (in-flight tasks detected).')
```

// Snowball 🐷 — all local snapshot writes removed; session setup reads live, never pre-renders
