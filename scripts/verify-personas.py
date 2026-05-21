import json, os, sys
from datetime import datetime, timezone

current_sha = os.environ.get('CURRENT_SHA', '')
specs = json.load(open('.hall-cache/personas/.advisory-roster.json'))

for p in ['.hall-cache/personas/automaton_base.md', '.hall-cache/personas/old-major.md',
          *[f'.hall-cache/personas/{s}.md' for s in specs]]:
    if not (os.path.exists(p) and os.path.getsize(p) > 0):
        print(f'ERROR: {p} empty or missing', file=sys.stderr)
        sys.exit(1)

lines = ['# Advisory Specialist Roster', '']
for name in specs:
    h = next((l.lstrip('# ').strip() for l in open(f'.hall-cache/personas/{name}.md') if l.startswith('#')), name)
    lines.append(f'- **{name}** (`hall:{name}`): {h}')
lines.append('\nFull personas at `.hall-cache/personas/<name>.md`. Load via Tier 2 subagent when needed.')
open('.hall-cache/session/roster-index.md', 'w').write('\n'.join(lines))

open('.hall-cache/personas/.fetched_at', 'w').write(
    datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
if current_sha:
    open('.hall-cache/personas/.agents-yml-sha', 'w').write(current_sha)
print(f'Fetched (SHA: {current_sha[:8]}).')
