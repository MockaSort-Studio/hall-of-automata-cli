import json, os, shutil, glob
from datetime import datetime, timezone

pr = os.environ.get('CLAUDE_PLUGIN_ROOT', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.makedirs('.hall-cache/methodology', exist_ok=True)
for f in glob.glob(f'{pr}/methodology/*.md'):
    shutil.copy(f, '.hall-cache/methodology/')

os.makedirs('.hall-cache/session/claude-agents', exist_ok=True)
specs = json.load(open('.hall-cache/personas/.advisory-roster.json'))
tpl = open(f'{pr}/templates/subagent-overlay.md.tpl').read()
for name in specs:
    lines = [l.rstrip() for l in open(f'.hall-cache/personas/{name}.md') if l.strip()]
    desc = next((l.lstrip('# ') for l in lines if l.startswith('#')), name)
    open(f'.hall-cache/session/claude-agents/{name}.md', 'w').write(
        tpl.replace('{{SPECIALIST_NAME}}', name).replace('{{SPECIALIST_DESCRIPTION}}', desc)
           .replace('{{PERSONA_PATH}}', f'.hall-cache/personas/{name}.md')
           .replace('{{CACHE_ROOT}}', '.hall-cache'))

at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
open('.hall-cache/session/CLAUDE-stack.md', 'w').write(
    open(f'{pr}/templates/CLAUDE-stack.md.tpl').read()
    .replace('{{PLUGIN_ROOT}}', pr).replace('{{CACHE_ROOT}}', '.hall-cache').replace('{{ASSEMBLED_AT}}', at))
open('.hall-cache/session/session-guard.md', 'w').write(
    open(f'{pr}/templates/session-guard.md.tpl').read()
    .replace('{{CACHE_ROOT}}', '.hall-cache'))

IL = '@.hall-cache/session/CLAUDE-stack.md'
mode = 'resume'
if not os.path.exists('CLAUDE.md'):
    open('CLAUDE.md', 'w').write(IL + '\n')
    mode = 'first_open'
else:
    content = open('CLAUDE.md').read()
    if IL not in content:
        mode = 'first_open'
    new_content = IL + '\n' + content.replace(IL, '').lstrip('\n')
    if new_content != content:
        open('CLAUDE.md', 'w').write(new_content)
open('.hall-cache/session/.open_mode', 'w').write(mode)

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
if key not in mcp_cfg:
    entry = list(snippet.values())[0]
    entry['args'] = [a.replace('HALL_CLI_PLUGIN_ROOT', pr) for a in entry['args']]
    mcp_cfg[key] = entry
    json.dump(mcp_cfg, open(mcp_path, 'w'), indent=2)
    print('Added hall-projects MCP server to .mcp.json.')

print(f'Setup complete (mode={mode}).')
