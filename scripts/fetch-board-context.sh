#!/usr/bin/env bash
# Fetches board summary via gh api graphql; writes board-context.md.
# Exits 0 silently when board is not provisioned.
set -uo pipefail

CFG=".hall-cache/session/config.json"
ITEMS_FILE=$(mktemp)
trap 'rm -f "$ITEMS_FILE"' EXIT

[ -f "$CFG" ] || exit 0
BOARD_NUM=$(python3 -c "import json; print(json.load(open('$CFG')).get('board_project_number',''))" 2>/dev/null || echo "")
[ -z "$BOARD_NUM" ] && exit 0

OWNER=$(git remote get-url origin 2>/dev/null | sed 's|.*github\.com[:/]\([^/]*\)/.*|\1|' || echo "")
[ -z "$OWNER" ] && exit 0

# Resolve project node ID: config.json first, then board-meta.json, then GetProjectMeta
BOARD_ID=$(python3 -c "import json; print(json.load(open('$CFG')).get('board_project_id',''))" 2>/dev/null || echo "")
if [ -z "$BOARD_ID" ] && [ -f ".hall-cache/session/board-meta.json" ]; then
    BOARD_ID=$(python3 -c "import json; print(json.load(open('.hall-cache/session/board-meta.json')).get('project_id',''))" 2>/dev/null || echo "")
fi
if [ -z "$BOARD_ID" ]; then
    BOARD_ID=$(gh api graphql \
        -f query='query GetProjectMeta($owner: String!, $number: Int!) {
          organization(login: $owner) {
            projectV2(number: $number) {
              id
              title
              fields(first: 50) {
                nodes {
                  ... on ProjectV2Field { id name dataType }
                  ... on ProjectV2SingleSelectField { id name options { id name } }
                  ... on ProjectV2IterationField { id name }
                }
              }
            }
          }
        }' \
        -f owner="$OWNER" -F number="$BOARD_NUM" \
        --jq '.data.organization.projectV2.id' 2>/dev/null || echo "")
    [ -z "$BOARD_ID" ] && exit 0
fi

# Paginate ListItems (up to 2 pages = 200 items max)
echo '[]' > "$ITEMS_FILE"
CURSOR=""
for _PAGE in 1 2; do
    CURSOR_ARGS=()
    [ -n "$CURSOR" ] && CURSOR_ARGS=(-f cursor="$CURSOR")
    PAGE_FILE=$(mktemp)
    gh api graphql \
        -f query='query ListItems($projectId: ID!, $cursor: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  content {
                    ... on Issue {
                      id number title state url
                      assignees(first: 5) { nodes { login } }
                      labels(first: 10) { nodes { name } }
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name field { ... on ProjectV2SingleSelectField { name } }
                      }
                      ... on ProjectV2ItemFieldTextValue {
                        text field { ... on ProjectV2Field { name } }
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        date field { ... on ProjectV2Field { name } }
                      }
                    }
                  }
                }
              }
            }
          }
        }' \
        -f projectId="$BOARD_ID" "${CURSOR_ARGS[@]}" > "$PAGE_FILE" 2>/dev/null \
        || { rm -f "$PAGE_FILE"; break; }
    CURSOR=$(python3 - "$ITEMS_FILE" "$PAGE_FILE" << 'PYEOF'
import json, sys
items_file, page_file = sys.argv[1], sys.argv[2]
page = json.load(open(page_file))
items_data = page.get('data', {}).get('node', {}).get('items', {})
existing = json.load(open(items_file))
existing.extend(items_data.get('nodes', []))
json.dump(existing, open(items_file, 'w'))
pi = items_data.get('pageInfo', {})
print(pi.get('endCursor', '') if pi.get('hasNextPage') else '')
PYEOF
    2>/dev/null || echo "")
    rm -f "$PAGE_FILE"
    [ -z "$CURSOR" ] && break
done

INVOKER=$(gh api user --jq '.login' 2>/dev/null || echo "")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

python3 - "$ITEMS_FILE" "$INVOKER" "$TIMESTAMP" << 'PYEOF'
import json, sys
items = json.load(open(sys.argv[1]))
invoker, timestamp = sys.argv[2], sys.argv[3]

def get_field(nodes, fname):
    for n in nodes:
        if not n:
            continue
        if (n.get('field') or {}).get('name') == fname:
            return n.get('name') or n.get('text') or n.get('date') or ''
    return ''

active, done_count, cross_invokers = [], 0, set()
for item in items:
    content = item.get('content') or {}
    num = content.get('number')
    if not num:
        continue
    fv = (item.get('fieldValues') or {}).get('nodes', [])
    status = get_field(fv, 'Status')
    if status in ('Done', 'Closed'):
        done_count += 1
        continue
    inv = get_field(fv, 'Invoker')
    active.append({
        'num': num,
        'title': content.get('title', ''),
        'status': status,
        'invoker': inv,
        'priority': get_field(fv, 'Priority'),
        'epic': get_field(fv, 'Epic'),
    })
    if inv and inv != invoker:
        cross_invokers.add(inv)

lines = [f'# Board Context (as of {timestamp})', '']
if active:
    lines += [
        '| # | Title | Status | Invoker | Priority | Epic |',
        '|---|-------|--------|---------|----------|------|',
    ]
    for r in active:
        lines.append(
            f"| {r['num']} | {r['title'][:50]} | {r['status']}"
            f" | {r['invoker']} | {r['priority']} | {r['epic']} |"
        )
else:
    lines.append('No active items.')
lines += ['', f"Done/Closed items: {done_count}"]
if cross_invokers:
    lines.append(f"\n> Cross-invoker items present from: {', '.join(sorted(cross_invokers))}")

open('.hall-cache/session/board-context.md', 'w').write('\n'.join(lines) + '\n')
PYEOF

# Snowball 🐷 — board awareness now flows into every session before the first word is spoken
