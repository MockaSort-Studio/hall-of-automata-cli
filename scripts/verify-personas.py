import json, os, sys
from datetime import datetime, timezone

root = os.path.expanduser('~/.hall')
current_sha = os.environ.get('CURRENT_SHA', '')

path = f'{root}/personas/roster-index.json'
try:
    d = json.load(open(path))
    assert isinstance(d, dict) and d, 'empty or malformed'
except Exception as e:
    print(f'ERROR: roster-index.json invalid: {e}', file=sys.stderr)
    sys.exit(1)

open(f'{root}/personas/.fetched_at', 'w').write(
    datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
if current_sha:
    open(f'{root}/personas/.agents-yml-sha', 'w').write(current_sha)
print(f'Verified ({len(d)} specialists, SHA: {current_sha[:8] or "none"}).')
