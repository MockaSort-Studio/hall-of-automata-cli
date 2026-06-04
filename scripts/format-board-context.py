import json, os, re
from datetime import datetime, timezone

root = os.path.expanduser('~/.hall')
slug = open(f'{root}/session/.repo-slug').read().strip()
proj = f'{root}/projects/{slug}'
b = json.load(open(f'{proj}/board.json'))
ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
items = b.get('items', [])

TASKLIST = re.compile(r'- \[.?\] #(\d+)')

def children(parent, pool):
    nums = {int(n) for n in TASKLIST.findall(parent.get('body', ''))}
    return [c for c in pool if c['issue_number'] in nums]

def fmt_status(i):
    return i.get('fields', {}).get('Status', '')

if all(i.get('fields', {}).get('ItemType') is None for i in items):
    active = [i for i in items if fmt_status(i) not in ('Done', 'Closed')]
    done = len(items) - len(active)
    hdr = [f'# Board Context (as of {ts})', '',
           '| # | Title | Status | Owner | Priority | Reference |',
           '|---|-------|--------|-------|----------|-----------|']
    rows = [f"| {r['issue_number']} | {r['title'][:50]} | {fmt_status(r)} "
            f"| {r.get('fields',{}).get('Owner','')} | {r.get('fields',{}).get('Priority','')} "
            f"| {r.get('fields',{}).get('Reference','')} |" for r in active] or ['No active items.']
    out = '\n'.join(hdr + rows + ['', f'Done/Closed items: {done}'])
else:
    okrs = [i for i in items if i['fields'].get('ItemType') == 'OKR']
    krs  = [i for i in items if i['fields'].get('ItemType') == 'KR']
    item_list = [i for i in items if i['fields'].get('ItemType') == 'Item']
    unlinked = [i for i in items if i['fields'].get('ItemType') not in ('OKR', 'KR', 'Item')]
    lines = [f'# Board Context (as of {ts})', '']
    for okr in okrs:
        owner = okr.get('fields', {}).get('Owner', '')
        lines.append(f"## OKR #{okr['issue_number']}: {okr['title'][:60]} [{fmt_status(okr)}] — Owner: {owner}")
        for kr in children(okr, krs):
            lines.append(f"  ### KR #{kr['issue_number']}: {kr['title'][:60]} [{fmt_status(kr)}]")
            for it in children(kr, item_list):
                lines.append(f"    - Item #{it['issue_number']}: {it['title'][:50]} [{fmt_status(it)}]")
        lines.append('')
    if unlinked:
        lines.append('## Unlinked Items')
        for i in unlinked:
            lines.append(f"- #{i['issue_number']}: {i['title'][:60]} [{fmt_status(i)}]")
    out = '\n'.join(lines)

open(f'{proj}/board-context.md', 'w').write(out + '\n')
print('Board context written.')
