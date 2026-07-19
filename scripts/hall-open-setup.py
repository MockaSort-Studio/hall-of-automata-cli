import json, os, re, shutil, glob, subprocess
from datetime import datetime, timezone

root = os.path.expanduser('~/.hall')
pr = os.environ.get('CLAUDE_PLUGIN_ROOT', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    subprocess.run(['git', 'remote', 'get-url', 'origin'], check=True, capture_output=True)
    standalone = False
except subprocess.CalledProcessError:
    standalone = True

# Slug derivation
slug = ''
if not standalone:
    try:
        origin = subprocess.run(
            ['git', 'remote', 'get-url', 'origin'], check=True, capture_output=True, text=True
        ).stdout.strip()
        cleaned = re.sub(r'.*github\.com[:/]', '', origin)
        cleaned = re.sub(r'\.git$', '', cleaned)
        parts = cleaned.split('/')
        slug = parts[1] if len(parts) >= 2 else ''
    except Exception:
        slug = ''
else:
    try:
        cfg_data = json.load(open(os.path.expanduser('~/.hall/.config.json')))
        target_repo = cfg_data.get('target_repo', '')
        slug = target_repo.split('/')[-1] if target_repo else ''
    except Exception:
        slug = ''

if slug:
    project_root = f'{root}/projects/{slug}'
    os.makedirs(project_root, exist_ok=True)
    open(f'{root}/session/.repo-slug', 'w').write(slug)
    if not os.path.exists(f'{project_root}/config.json'):
        open(f'{project_root}/config.json', 'w').write('{}')
    stack_dir = f'{project_root}/session'
    os.makedirs(stack_dir, exist_ok=True)
else:
    project_root = f'{root}/session'
    stack_dir = f'{root}/session'

os.makedirs(f'{root}/methodology', exist_ok=True)
for f in glob.glob(f'{pr}/methodology/*.md'):
    shutil.copy(f, f'{root}/methodology/')

os.makedirs(f'{root}/session/claude-agents', exist_ok=True)
open(f'{root}/session/.plugin-root', 'w').write(pr)
specs = json.load(open(f'{root}/personas/.advisory-roster.json'))
tpl = open(f'{pr}/templates/subagent-overlay.md.tpl').read()
for name in specs:
    lines = [l.rstrip() for l in open(f'{root}/personas/{name}.md') if l.strip()]
    desc = next((l.lstrip('# ') for l in lines if l.startswith('#')), name)
    open(f'{root}/session/claude-agents/{name}.md', 'w').write(
        tpl.replace('{{SPECIALIST_NAME}}', name).replace('{{SPECIALIST_DESCRIPTION}}', desc)
           .replace('{{PERSONA_PATH}}', f'{root}/personas/{name}.md')
           .replace('{{CACHE_ROOT}}', root))

at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
open(f'{stack_dir}/CLAUDE-stack.md', 'w').write(
    open(f'{pr}/templates/CLAUDE-stack.md.tpl').read()
    .replace('{{PLUGIN_ROOT}}', pr).replace('{{CACHE_ROOT}}', root)
    .replace('{{PROJECT_ROOT}}', project_root).replace('{{ASSEMBLED_AT}}', at))

mode = 'resume' if os.path.exists(f'{root}/session/.open_mode') else 'first_open'


LEGACY_IMPORT = '@.hall-cache/session/CLAUDE-stack.md'
if os.path.exists('CLAUDE.md'):
    content = open('CLAUDE.md').read()
    if LEGACY_IMPORT in content:
        cleaned = '\n'.join(l for l in content.splitlines() if l.strip() != LEGACY_IMPORT)
        open('CLAUDE.md', 'w').write(cleaned.lstrip('\n'))

open(f'{root}/session/.open_mode', 'w').write(mode)

if not standalone:
    if not os.path.exists('.claude/settings.json'):
        os.makedirs('.claude', exist_ok=True)
        open('.claude/settings.json', 'w').write(
            open(f'{pr}/templates/claude-settings.json').read().replace('HALL_CLI_PLUGIN_ROOT', pr))
        print('Configured unattended permissions (takes effect next session).')

    hook_src = f'{pr}/hooks/git/pre-commit'
    hook_dst = '.git/hooks/pre-commit'
    if os.path.exists('.git/hooks') and not os.path.exists(hook_dst):
        shutil.copy(hook_src, hook_dst)
        os.chmod(hook_dst, 0o755)
        print('Installed git pre-commit guard.')

    mcp_path = '.mcp.json'
    snippet_path = f'{pr}/templates/mcp-hall-projects-snippet.json'
    mcp_cfg = {}
    if os.path.exists(mcp_path):
        try:
            mcp_cfg = json.load(open(mcp_path))
        except json.JSONDecodeError:
            pass
    snippet = json.load(open(snippet_path))
    key = 'hall-projects'
    entry = list(snippet.values())[0]
    entry['args'] = [a.replace('HALL_CLI_PLUGIN_ROOT', pr) for a in entry['args']]
    is_new = key not in mcp_cfg
    if is_new:
        mcp_cfg[key] = entry
    else:
        mcp_cfg[key]['args'] = entry['args']
    json.dump(mcp_cfg, open(mcp_path, 'w'), indent=2)
    print(f"{'Added' if is_new else 'Updated'} hall-projects MCP server in .mcp.json.")

print(f'Setup complete (mode={mode}).')
