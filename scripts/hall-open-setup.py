import json, os

root = os.path.expanduser('~/.hall')
pr = os.environ.get('CLAUDE_PLUGIN_ROOT', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

slug = ''
org = ''
org_slug = ''
slug_file = os.path.expanduser('~/.hall/session/.repo-slug')
try:
    org_slug = open(slug_file).read().strip()
    slug = org_slug.split('/')[-1] if org_slug else ''
    org = org_slug.split('/')[0] if '/' in org_slug else ''
    if slug:
        print(f'Using project: {slug}')
except Exception:
    pass

if org_slug:
    project_root = f'{root}/{org_slug}'
    os.makedirs(project_root, exist_ok=True)
    open(f'{root}/session/.repo-slug', 'w').write(org_slug)
    if not os.path.exists(f'{project_root}/config.json'):
        open(f'{project_root}/config.json', 'w').write('{}')
    os.makedirs(f'{project_root}/session', exist_ok=True)
else:
    project_root = f'{root}/session'

# Phase 1 — invariant: overlays (once per session; gated by agents.json SHA)
phase1_marker = f'{root}/session/.invariant-built'
current_sha = (open(f'{root}/session/.current-sha').read().strip()
               if os.path.exists(f'{root}/session/.current-sha') else '')
cached_sha = (open(phase1_marker).read().strip()
              if os.path.exists(phase1_marker) else None)

if cached_sha is None or cached_sha != current_sha or os.environ.get('HALL_REFRESH_INVARIANT'):
    os.makedirs(f'{root}/session/claude-agents', exist_ok=True)
    open(f'{root}/session/.plugin-root', 'w').write(pr)
    roster = json.load(open(f'{root}/agent-index.json'))
    tpl = open(f'{pr}/templates/subagent-overlay.md.tpl').read()
    for name, data in roster.items():
        desc = data.get('display_name', name)
        open(f'{root}/session/claude-agents/{name}.md', 'w').write(
            tpl.replace('{{SPECIALIST_NAME}}', name).replace('{{SPECIALIST_DESCRIPTION}}', desc)
               .replace('{{ORG}}', org)
               .replace('{{CACHE_ROOT}}', root))

    open(phase1_marker, 'w').write(current_sha)
    print('Phase 1 built (invariant layer).')
else:
    print('Phase 1 cached (invariant layer — skip).')

mode = 'resume' if os.path.exists(f'{root}/session/.open_mode') else 'first_open'
open(f'{root}/session/.open_mode', 'w').write(mode)

print(f'Setup complete (mode={mode}).')
