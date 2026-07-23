import json, os, sys

root = os.path.expanduser('~/.hall')
current_sha = os.environ.get('CURRENT_SHA', '')

path = f'{root}/agent-index.json'
try:
    d = json.load(open(path))
    assert isinstance(d, dict) and d, 'empty or malformed'
except Exception as e:
    print(f'ERROR: agent-index.json invalid: {e}', file=sys.stderr)
    sys.exit(1)

if current_sha:
    open(f'{root}/agent-index.sha', 'w').write(current_sha)
print(f'Verified ({len(d)} specialists, SHA: {current_sha[:8] or "none"}).')
