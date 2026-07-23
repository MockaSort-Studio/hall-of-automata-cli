import json, os, shutil, glob
from datetime import datetime, timezone

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
    stack_dir = f'{project_root}/session'
    os.makedirs(stack_dir, exist_ok=True)
else:
    project_root = f'{root}/session'
    stack_dir = f'{root}/session'

at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

# Phase 1 — invariant: methodology, overlays, stack (once per session; gated by agents.json SHA)
phase1_marker = f'{root}/session/.invariant-built'
current_sha = (open(f'{root}/session/.current-sha').read().strip()
               if os.path.exists(f'{root}/session/.current-sha') else '')
cached_sha = (open(phase1_marker).read().strip()
              if os.path.exists(phase1_marker) else None)

if cached_sha is None or cached_sha != current_sha or os.environ.get('HALL_REFRESH_INVARIANT'):
    os.makedirs(f'{root}/methodology', exist_ok=True)
    for f in glob.glob(f'{pr}/methodology/*.md'):
        shutil.copy(f, f'{root}/methodology/')

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

    open(f'{root}/session/CLAUDE-stack-invariant.md', 'w').write(
        open(f'{pr}/templates/CLAUDE-stack-invariant.md.tpl').read()
        .replace('{{CACHE_ROOT}}', root).replace('{{ASSEMBLED_AT}}', at))

    open(phase1_marker, 'w').write(current_sha)
    print('Phase 1 built (invariant layer).')
else:
    print('Phase 1 cached (invariant layer — skip).')

# Phase 2 — project: context.md, board-context.md, plan state (per project, always rebuilt)
open(f'{stack_dir}/CLAUDE-stack-project.md', 'w').write(
    open(f'{pr}/templates/CLAUDE-stack-project.md.tpl').read()
    .replace('{{PROJECT_ROOT}}', project_root).replace('{{ASSEMBLED_AT}}', at))

open(f'{stack_dir}/CLAUDE-stack.md', 'w').write(
    open(f'{pr}/templates/CLAUDE-stack.md.tpl').read()
    .replace('{{PLUGIN_ROOT}}', pr).replace('{{CACHE_ROOT}}', root)
    .replace('{{STACK_DIR}}', stack_dir).replace('{{ASSEMBLED_AT}}', at))

print(f'Phase 2 built (project layer — {slug or "no project"})')

mode = 'resume' if os.path.exists(f'{root}/session/.open_mode') else 'first_open'
open(f'{root}/session/.open_mode', 'w').write(mode)

print(f'Setup complete (mode={mode}).')
