---
name: hall-open-session-setup
description: Session setup — methodology overlays, cron restart; executed from hall-open Step 3
---

# Session Setup

Execute only from hall-open Step 3. Runs setup.py, restarts cron if in-flight tasks exist.

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/hall-open-setup.py"
```

```bash
python3 << 'PYEOF'
import json, os
roster = json.load(open(os.path.expanduser('~/.hall/agent-index.json')))
lines = ['# Specialist Roster\n']
for slug, data in roster.items():
    lines.append(f"## {data['display_name']} (`{slug}`)")
    lines.append(f"**Domains:** {', '.join(data['domains'])}")
    lines.append(f"**Roles:** {', '.join(data['roles'])}")
    lines.append(data['scope_summary'])
    lines.append('')
open(os.path.expanduser('~/.hall/session/roster-index.md'), 'w').write('\n'.join(lines))
PYEOF
```

**Cron restart (resume with in-flight tasks):**

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
INFLIGHT=false
if HALL_SLUG="$SLUG" python3 - << 'PYEOF'
import json, glob, os, sys
slug = os.environ.get('HALL_SLUG', '')
found = any(
    any(t.get('status') in ('DISPATCHED', 'IN_PROGRESS') for t in json.load(open(f)).get('tasks', []))
    for f in glob.glob(os.path.expanduser('~/.hall/' + slug + '/plans/*/plan.json'))
)
sys.exit(0 if found else 1)
PYEOF
then
  INFLIGHT=true
fi
CRON_EXISTS=$([ -f ~/.hall/$SLUG/cron.json ] && echo true || echo false)
echo "INFLIGHT=$INFLIGHT | CRON_EXISTS=$CRON_EXISTS"
```

If `INFLIGHT=true` and `CRON_EXISTS=false`: call `CronCreate` with `schedule=*/15 * * * *` and `prompt="Autonomous plan advancement (cron): run /hall:reconcile. If any task has needs_review: true after reconcile, run /hall:review. If newly unlocked READY tasks exist, dispatch them without confirmation. Append one-line summary to ~/.hall/cron-log.md."` Then write the returned cron ID:

```python
import json, os
from datetime import datetime, timezone
slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip()
cron_id = "<returned cron ID>"
json.dump(
    {"cron_id": cron_id, "created_at": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    open(os.path.expanduser(f'~/.hall/{slug}/cron.json'), 'w')
)
print('Cron restarted (in-flight tasks detected).')
```

// Snowball 🐷 — board context stripped; board state is now fetched live when needed, not persisted at session start
