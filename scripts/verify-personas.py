import json, os, sys
from datetime import datetime, timezone

root = os.path.expanduser('~/.hall')
current_sha = os.environ.get('CURRENT_SHA', '')
specs = json.load(open(f'{root}/personas/.advisory-roster.json'))

for p in [f'{root}/personas/automaton_base.md', f'{root}/personas/old-major.md',
          *[f'{root}/personas/{s}.md' for s in specs]]:
    if not (os.path.exists(p) and os.path.getsize(p) > 0):
        print(f'ERROR: {p} empty or missing', file=sys.stderr)
        sys.exit(1)

lines = ['# Advisory Specialist Roster', '']
for name in specs:
    h = next((l.lstrip('# ').strip() for l in open(f'{root}/personas/{name}.md') if l.startswith('#')), name)
    lines.append(f'- **{name}** (`hall:{name}`): {h}')
lines.append(f'\nFull personas at `~/.hall/personas/<name>.md`. Load via Tier 2 subagent when needed.')
open(f'{root}/session/roster-index.md', 'w').write('\n'.join(lines))

open(f'{root}/personas/.fetched_at', 'w').write(
    datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
if current_sha:
    open(f'{root}/personas/.agents-yml-sha', 'w').write(current_sha)
print(f'Fetched (SHA: {current_sha[:8]}).')
