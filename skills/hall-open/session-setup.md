---
name: hall-open-session-setup
description: Session setup — methodology overlays, cron restart, board context; executed from hall-open Step 3
---

# Session Setup

Execute only from hall-open Step 3. Runs setup.py, restarts cron if in-flight tasks exist, loads board context.

```bash
OLD_SLUG=$(cat ~/.hall/session/.old-slug 2>/dev/null || echo "")
if [ -n "$OLD_SLUG" ]; then
  bash "$CLAUDE_PLUGIN_ROOT/scripts/session-purge-project.sh" "$OLD_SLUG"
fi
```

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/hall-open-setup.py"
```

```bash
python3 << 'PYEOF'
import json, os
roster = json.load(open(os.path.expanduser('~/.hall/personas/roster-index.json')))
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
    for f in glob.glob(os.path.expanduser('~/.hall/projects/' + slug + '/plans/*/plan.json'))
)
sys.exit(0 if found else 1)
PYEOF
then
  INFLIGHT=true
fi
CRON_EXISTS=$([ -f ~/.hall/projects/$SLUG/cron.json ] && echo true || echo false)
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
    open(os.path.expanduser(f'~/.hall/projects/{slug}/cron.json'), 'w')
)
print('Cron restarted (in-flight tasks detected).')
```

**Board context:** Read `board_project_number` from `~/.hall/projects/$SLUG/config.json`. If absent, skip silently.

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
BOARD_NUM=$(python3 -c "import json, os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/config.json'))).get('board_project_number',''))" 2>/dev/null || echo "")
OWNER=$(echo "$REPO" | cut -d/ -f1)
```

If `BOARD_NUM` is non-empty:

```bash
gh project item-list "$BOARD_NUM" --owner "$OWNER" --format json --limit 1000 \
  > ~/.hall/projects/$SLUG/board-raw.json 2>/dev/null \
  && echo "BOARD_OK" || echo "BOARD_ERROR"
```

On `BOARD_ERROR`: print `"Board context unavailable (board not provisioned)."` and continue. On `BOARD_OK`:

```bash
python3 << 'PYEOF'
import json, os
from datetime import datetime, timezone
root = os.path.expanduser('~/.hall')
slug = open(f'{root}/session/.repo-slug').read().strip()
proj = f'{root}/projects/{slug}'
RESERVED = {'id', 'title', 'number', 'type', 'body', 'url', 'assignees', 'labels',
            'milestone', 'repository', 'createdAt', 'updatedAt', 'closedAt'}
raw = json.load(open(f'{proj}/board-raw.json'))
items = []
for it in raw.get('items', []):
    fields = {k: v for k, v in it.items() if k not in RESERVED and v not in (None, '')}
    items.append({
        'id': it.get('id', ''),
        'issue_number': it.get('number'),
        'title': it.get('title', ''),
        'state': 'OPEN',
        'url': it.get('url', ''),
        'body': it.get('body', ''),
        'assignees': it.get('assignees', []),
        'labels': it.get('labels', []),
        'fields': fields,
    })
json.dump(
    {'fetched_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
     'project_id': '', 'items': items},
    open(f'{proj}/board.json', 'w'), indent=2)
print(f'Board fetched: {len(items)} items.')
PYEOF
```

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/format-board-context.py"
```

```bash
# Ensure board-context.md always exists for CLAUDE-stack @-import
[ -f ~/.hall/projects/$SLUG/board-context.md ] \
  || printf '# Board Context\nNot provisioned.\n' > ~/.hall/projects/$SLUG/board-context.md
```

// Snowball 🐷 — session setup now has its own room; SKILL.md can breathe
