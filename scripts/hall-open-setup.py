import os

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

os.makedirs(f'{root}/session', exist_ok=True)
open(f'{root}/plugin-root', 'w').write(pr)

mode = 'resume' if os.path.exists(f'{root}/session/.open_mode') else 'first_open'
open(f'{root}/session/.open_mode', 'w').write(mode)

print(f'Setup complete (mode={mode}).')
