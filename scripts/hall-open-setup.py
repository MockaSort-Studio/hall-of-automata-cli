import json, os, re, shutil, glob, subprocess
from datetime import datetime, timezone

root = os.path.expanduser('~/.hall')
pr = os.environ.get('CLAUDE_PLUGIN_ROOT', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    subprocess.run(['git', 'remote', 'get-url', 'origin'], check=True, capture_output=True)
    standalone = False
except subprocess.CalledProcessError:
    standalone = True

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
        pass

if not slug:
    cfg_path = os.path.expanduser('~/.hall/.config.json')
    try:
        cfg_data = json.load(open(cfg_path))
        target_repo = cfg_data.get('target_repo', '')
        slug = target_repo.split('/')[-1] if target_repo else ''
        if slug:
            print(f'Using project from ~/.hall/.config.json: {slug}')
    except Exception:
        pass

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

at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

# Phase 1 — invariant: methodology, overlays, stack (once per session; gated by agents.yml SHA)
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
    roster = json.load(open(f'{root}/personas/roster-index.json'))
    tpl = open(f'{pr}/templates/subagent-overlay.md.tpl').read()
    for name, data in roster.items():
        desc = data.get('display_name', name)
        open(f'{root}/session/claude-agents/{name}.md', 'w').write(
            tpl.replace('{{SPECIALIST_NAME}}', name).replace('{{SPECIALIST_DESCRIPTION}}', desc)
               .replace('{{PERSONA_PATH}}', f'{root}/personas/{name}.md')
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

print(f'Phase 2 built (project layer — {slug or "standalone"})')

LEGACY_IMPORT = '@.hall-cache/session/CLAUDE-stack.md'
if os.path.exists('CLAUDE.md'):
    content = open('CLAUDE.md').read()
    if LEGACY_IMPORT in content:
        cleaned = '\n'.join(l for l in content.splitlines() if l.strip() != LEGACY_IMPORT)
        open('CLAUDE.md', 'w').write(cleaned.lstrip('\n'))

mode = 'resume' if os.path.exists(f'{root}/session/.open_mode') else 'first_open'
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
