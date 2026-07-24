---
name: hall-status
description: Render the current board from a live project query + issue state
argument-hint: [--format json]
allowed-tools: [Bash]
---

# /hall:status

Render the current plan board from live GitHub data.

## Setup

```bash
SLUG=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
ORG=$(echo "$SLUG" | cut -d/ -f1)
REPO_NAME=$(echo "$SLUG" | cut -d/ -f2)
REPO="$ORG/$REPO_NAME"
BOARD_NUM=$(python3 - <<PYEOF
import json, os
slug = "$SLUG"
cfg = os.path.expanduser(f'~/.hall/{slug}/config.json')
try: print(json.load(open(cfg)).get('board_project_number', ''))
except: print('')
PYEOF
)
```

If `BOARD_NUM` is empty: say "No project board configured — run `/hall:open` to start a plan." and stop.

## --format json

```bash
gh project item-list "$BOARD_NUM" --owner "$ORG" --format json --limit 200
```

Stop after printing.

## Fetch live data

```bash
gh project item-list "$BOARD_NUM" --owner "$ORG" --format json --limit 200 \
  > /tmp/hall-board.json
gh issue list --repo "$REPO" --state all \
  --json number,title,state,labels,url --limit 500 \
  > /tmp/hall-issues.json
gh pr list --repo "$REPO" --state open \
  --json number,body,title --limit 200 \
  > /tmp/hall-prs.json
```

## Render

Board view groups issues by Hall status derived from labels and PR close-reference scan. Issues closed without a linked open PR are MERGED; issues referenced by an open PR's closing keyword are REVIEWING.

```python3
import json, re, os

board  = json.load(open('/tmp/hall-board.json'))
issues = json.load(open('/tmp/hall-issues.json'))
prs    = json.load(open('/tmp/hall-prs.json'))

issue_map = {i['number']: i for i in issues}

STATUS_LABELS = {'hall:in-progress', 'hall:awaiting-input', 'hall:invoker-queued'}

# Issues referenced by an open PR via a closing keyword are REVIEWING
reviewing = set()
for pr in prs:
    for m in re.findall(
        r'(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)',
        pr.get('body') or '', re.I,
    ):
        reviewing.add(int(m))

def hall_status(issue):
    ls = {l['name'] for l in issue.get('labels', [])}
    if issue['state'] == 'open':
        if 'hall:awaiting-input' in ls: return 'AWAITING_INPUT'
        if 'hall:invoker-queued' in ls: return 'DISPATCHED'
        if 'hall:in-progress'    in ls: return 'IN_PROGRESS'
        if any(l.startswith('hall:') and l not in STATUS_LABELS for l in ls):
            return 'IN_PROGRESS'
        return 'PLANNED'
    return 'REVIEWING' if issue['number'] in reviewing else 'MERGED'

def specialist(issue):
    for l in issue.get('labels', []):
        n = l['name']
        if n.startswith('hall:') and n not in STATUS_LABELS:
            return n[5:]
    return ''

items = []
for bi in board.get('items', []):
    if bi.get('type', '').upper() != 'ISSUE':
        continue
    m = re.search(r'/issues/(\d+)$', bi.get('url', ''))
    if not m:
        continue
    num   = int(m.group(1))
    issue = issue_map.get(num)
    if not issue:
        continue
    items.append(dict(
        number=num, title=issue['title'], url=issue['url'],
        status=hall_status(issue), spec=specialist(issue),
    ))

GROUPS = [
    ('In flight',          {'IN_PROGRESS', 'DISPATCHED'}),
    ('Awaiting input',     {'AWAITING_INPUT'}),
    ('In review',          {'REVIEWING'}),
    ('Planned',            {'PLANNED'}),
    ('Failed / escalated', {'FAILED'}),
    ('Done',               {'MERGED'}),
]
buckets = {name: [] for name, _ in GROUPS}
for it in items:
    for name, statuses in GROUPS:
        if it['status'] in statuses:
            buckets[name].append(it)
            break
for name, its in buckets.items():
    if not its:
        continue
    print(f'\n**{name}**')
    if name == 'Done':
        print(f'  {len(its)} merged ✓')
    else:
        for it in its:
            spec = f' — {it["spec"]}' if it['spec'] else ''
            print(f'  • #{it["number"]} {it["title"]}{spec}')
active = sum(len(buckets[g]) for g in ('In flight', 'Awaiting input', 'In review'))
print(
    f'\n{active} in flight · {len(buckets["Planned"])} planned · '
    f'{len(buckets["Failed / escalated"])} failed · {len(buckets["Done"])} done'
)
```
