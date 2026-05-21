---
name: hall-open
description: Enter Old Major session mode — fetch personas, assemble session stack, activate
argument-hint: [--refresh|--verify]
allowed-tools: [Bash, Write, AskUserQuestion, mcp__github__get_file_contents, mcp__github__get_me, mcp__github__get_team_members, mcp__github__search_repositories, mcp__hall-projects__read_board]
---

# /hall:open

Enter Hall session mode. Fetches personas, assembles session stack, activates Old Major.

Use `--refresh` to force persona re-fetch even if cache is fresh. Use `--verify` to force invoker re-check.

## Execution sequence

Execute each step in order. Hard-stop on any error; warn-and-continue on non-critical issues.

### Step 1: Preflight + diagnostics

**Flag pre-processing:**
- If `--verify` was passed: `rm -f .hall-cache/invoker.json`
- If `--refresh` was passed: treat `NEED_FETCH=true` regardless of the block output below.

```bash
set -euo pipefail

# Hard stops
gh auth status &>/dev/null || { echo "ERROR: gh not authenticated" >&2; exit 1; }
REPO=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]||;s|\.git$||')

[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ] || echo "WARN: GITHUB_PERSONAL_ACCESS_TOKEN not set — MCP unavailable."

# Gitignore
grep -q "\.hall-cache" .gitignore 2>/dev/null \
  || { echo ".hall-cache/" >> .gitignore; echo "Added .hall-cache/ to .gitignore"; }

# Cache state
mkdir -p .hall-cache/personas .hall-cache/session .hall-cache/plans
```

Call `get_file_contents` MCP: owner=`MockaSort-Studio`, repo=`hall-of-automata`, path=`agents.yml`. Extract `sha` → `CURRENT_SHA`.
`# On rate_limit/secondary-rate-limit error: gh api repos/MockaSort-Studio/hall-of-automata/contents/agents.yml --jq '.sha'`

```bash
CACHED_SHA=$(cat .hall-cache/personas/.agents-yml-sha 2>/dev/null || echo "")
FETCHED_AT=$(cat .hall-cache/personas/.fetched_at 2>/dev/null || echo "")
NOW=$(date +%s)
FETCHED_TS=$([ -n "$FETCHED_AT" ] && date -d "$FETCHED_AT" +%s 2>/dev/null || echo "0")

NEED_FETCH=false
[ "$CURRENT_SHA" != "$CACHED_SHA" ] && NEED_FETCH=true
[ $(( NOW - FETCHED_TS )) -gt 86400 ] && NEED_FETCH=true
[ -z "$FETCHED_AT" ] && NEED_FETCH=true
python3 -c "import json; d=json.load(open('.hall-cache/personas/.advisory-roster.json')); assert isinstance(d,list)" 2>/dev/null \
  || NEED_FETCH=true

ACTIVE_PLAN=false
for d in .hall-cache/plans/*/; do
  f="${d}plan.md"; [ -f "$f" ] || continue
  grep -qm1 "Status:.*DONE" "$f" 2>/dev/null || { ACTIVE_PLAN=true; break; }
done

AUTO_LEVEL=$(python3 -c "import json; print(json.load(open('.hall-cache/session/config.json')).get('automation_level','missing'))" \
  2>/dev/null || echo "missing")
LOCAL_MODE=$(python3 -c "import json; print(json.load(open('.hall-cache/session/config.json')).get('local_mode','missing'))" \
  2>/dev/null || echo "missing")

echo "$CURRENT_SHA" > .hall-cache/session/.current-sha
echo "NEED_FETCH=$NEED_FETCH | ACTIVE_PLAN=$ACTIVE_PLAN | AUTO_LEVEL=$AUTO_LEVEL | LOCAL_MODE=$LOCAL_MODE"
echo "CONTEXT_EXISTS=$([ -f .hall-cache/session/context.md ] && echo true || echo false)"
echo "SHA=${CURRENT_SHA:0:8}"
```

### Step 2: Persona fetch (skip if NEED_FETCH=false)

Read `CURRENT_SHA` from `.hall-cache/session/.current-sha`; if absent, call `get_file_contents` MCP (owner=`MockaSort-Studio`, repo=`hall-of-automata`, path=`agents.yml`) and extract `sha`.
`# On rate_limit/secondary-rate-limit error: gh api repos/MockaSort-Studio/hall-of-automata/contents/agents.yml --jq '.sha'`

Call `get_file_contents` MCP: owner=`MockaSort-Studio`, repo=`hall-of-automata`, path=`roster/`. From the returned array, keep entries where type=`file`, name ends in `.md`, name ≠ `old-major.md` and ≠ `README.md`. Write the names (without `.md`) as a JSON array to `.hall-cache/personas/.advisory-roster.json`.
`# On rate_limit/secondary-rate-limit error: gh api repos/MockaSort-Studio/hall-of-automata/contents/roster --jq '[.[] | select(.type=="file" and (.name|endswith(".md")) and .name!="old-major.md" and .name!="README.md") | .name[:-3]]' > .hall-cache/personas/.advisory-roster.json`

```bash
python3 -c "import json,sys; d=json.load(open('.hall-cache/personas/.advisory-roster.json')); assert isinstance(d,list), f'API error: {d}'" \
  || exit 1
```

Fetch and write persona files via Bash (the Write tool fails on new files; gh api writes directly):

```bash
SPECS=$(python3 -c "import json; print(' '.join(json.load(open('.hall-cache/personas/.advisory-roster.json'))))")
gh api repos/MockaSort-Studio/hall-of-automata/contents/agents/automaton_base.md \
  --jq '.content' | base64 -d > .hall-cache/personas/automaton_base.md
gh api repos/MockaSort-Studio/hall-of-automata/contents/roster/old-major.md \
  --jq '.content' | base64 -d > .hall-cache/personas/old-major.md
for name in $SPECS; do
  gh api "repos/MockaSort-Studio/hall-of-automata/contents/roster/${name}.md" \
    --jq '.content' | base64 -d > ".hall-cache/personas/${name}.md"
done
```

```bash
python3 << 'PYEOF'
import json, sys, os
specs = json.load(open('.hall-cache/personas/.advisory-roster.json'))
for p in ['.hall-cache/personas/automaton_base.md', '.hall-cache/personas/old-major.md',
          *[f'.hall-cache/personas/{s}.md' for s in specs]]:
    if not (os.path.exists(p) and os.path.getsize(p) > 0):
        print(f'ERROR: {p} empty or missing', file=sys.stderr); sys.exit(1)
lines = ['# Advisory Specialist Roster', '']
for name in specs:
    h = next((l.lstrip('# ').strip() for l in open(f'.hall-cache/personas/{name}.md') if l.startswith('#')), name)
    lines.append(f'- **{name}** (`hall:{name}`): {h}')
lines.append('\nFull personas at `.hall-cache/personas/<name>.md`. Load via Tier 2 subagent when needed.')
open('.hall-cache/session/roster-index.md', 'w').write('\n'.join(lines))
PYEOF

date -u +"%Y-%m-%dT%H:%M:%SZ" > .hall-cache/personas/.fetched_at
echo "$CURRENT_SHA" > .hall-cache/personas/.agents-yml-sha
echo "Fetched (SHA: ${CURRENT_SHA:0:8})."
```

### Step 3: Setup — methodology, overlays, stack, watcher

```bash
python3 << 'PYEOF'
import json, os, shutil, glob
from datetime import datetime, timezone
pr = os.environ.get('CLAUDE_PLUGIN_ROOT', '/home/mike/Workspace/hall-of-automata-cli')
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
    open('CLAUDE.md', 'w').write(IL + '\n'); mode = 'first_open'
elif IL not in open('CLAUDE.md').read():
    open('CLAUDE.md', 'a').write('\n' + IL + '\n'); mode = 'first_open'
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
    try: mcp_cfg = json.load(open(mcp_path))
    except json.JSONDecodeError: pass
snippet = json.load(open(snippet_path))
key = 'hall-projects'
if key not in mcp_cfg:
    entry = list(snippet.values())[0]
    entry['args'] = [a.replace('HALL_CLI_PLUGIN_ROOT', pr) for a in entry['args']]
    mcp_cfg[key] = entry
    json.dump(mcp_cfg, open(mcp_path, 'w'), indent=2)
    print('Added hall-projects MCP server to .mcp.json.')
print(f'Setup complete (mode={mode}).')
PYEOF
```

**Board context:** Read `board_project_number` from `.hall-cache/session/config.json`. If absent, skip silently.

```bash
BOARD_NUM=$(python3 -c "import json; print(json.load(open('.hall-cache/session/config.json')).get('board_project_number',''))" 2>/dev/null || echo "")
OWNER=$(echo "$REPO" | cut -d/ -f1)
```

If `BOARD_NUM` is non-empty: call `read_board` MCP with `owner=$OWNER` and `project_number=$BOARD_NUM` (integer). On success, format `board-context.md`:

```bash
python3 << 'PYEOF'
import json, re
from datetime import datetime, timezone

b = json.load(open('.hall-cache/session/board.json'))
ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
items = b.get('items', [])

TASKLIST = re.compile(r'- \[.?\] #(\d+)')

def children(parent, pool):
    nums = {int(n) for n in TASKLIST.findall(parent.get('body', ''))}
    return [c for c in pool if c['issue_number'] in nums]

def fmt_status(i):
    return i.get('fields', {}).get('Status', '')

if all(i.get('fields', {}).get('Type') is None for i in items):
    # flat-table fallback for boards not yet migrated
    active = [i for i in items if fmt_status(i) not in ('Done', 'Closed')]
    done = len(items) - len(active)
    hdr = [f'# Board Context (as of {ts})', '',
           '| # | Title | Status | Owner | Priority | Reference |',
           '|---|-------|--------|-------|----------|-----------|']
    rows = [f"| {r['issue_number']} | {r['title'][:50]} | {fmt_status(r)} "
            f"| {r.get('fields',{}).get('Owner','')} | {r.get('fields',{}).get('Priority','')} "
            f"| {r.get('fields',{}).get('Reference','')} |" for r in active] or ['No active items.']
    out = '\n'.join(hdr + rows + ['', f'Done/Closed items: {done}'])
else:
    okrs = [i for i in items if i['fields'].get('Type') == 'OKR']
    krs  = [i for i in items if i['fields'].get('Type') == 'KR']
    item_list = [i for i in items if i['fields'].get('Type') == 'Item']
    unlinked = [i for i in items if i['fields'].get('Type') not in ('OKR', 'KR', 'Item')]
    lines = [f'# Board Context (as of {ts})', '']
    for okr in okrs:
        owner = okr.get('fields', {}).get('Owner', '')
        lines.append(f"## OKR #{okr['issue_number']}: {okr['title'][:60]} [{fmt_status(okr)}] — Owner: {owner}")
        for kr in children(okr, krs):
            lines.append(f"  ### KR #{kr['issue_number']}: {kr['title'][:60]} [{fmt_status(kr)}]")
            for it in children(kr, item_list):
                lines.append(f"    - Item #{it['issue_number']}: {it['title'][:50]} [{fmt_status(it)}]")
        lines.append('')
    if unlinked:
        lines.append('## Unlinked Items')
        for i in unlinked:
            lines.append(f"- #{i['issue_number']}: {i['title'][:60]} [{fmt_status(i)}]")
    out = '\n'.join(lines)

open('.hall-cache/session/board-context.md', 'w').write(out + '\n')
print('Board context written.')
PYEOF
```

On error from `read_board`: print `"Board context unavailable (board not provisioned)."` and continue.

```bash
# Ensure board-context.md always exists for CLAUDE-stack @-import
[ -f .hall-cache/session/board-context.md ] \
  || printf '# Board Context\nNot provisioned.\n' > .hall-cache/session/board-context.md
```

```bash
# Watcher
WPID=$(cat .hall-cache/watcher.pid 2>/dev/null || echo "")
if [ -n "$WPID" ] && kill -0 "$WPID" 2>/dev/null; then
  echo "Watcher OK (PID $WPID)."
else
  nohup bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/watcher.sh" &> .hall-cache/watcher.log &
  echo "Watcher started."
fi
```

### Step 4: Context synthesis (only if CONTEXT_EXISTS=false)

Read the first 30 lines of `README.md` and write a 2–4 sentence brief to `.hall-cache/session/context.md`. If no README: `Project context: not available.`

### Step 5: Context injection (only if open_mode=first_open)

Read `.hall-cache/session/CLAUDE-stack.md` and each @-imported file in order. Apply as operating instructions. If `resume`: skip — stack already loaded via CLAUDE.md @-imports.

### Step 6: Invoker detection gate (only if LOCAL_MODE=missing)

Use `AskUserQuestion` with one question:
- **Header:** `"Hall invoker?"`
- **Question:** `"Are you a Hall invoker? An invoker is a member of the automata-invokers team on GitHub — you have dispatch access and can send tasks to Hall specialists. Non-invokers get local orchestration mode: Old Major plans and implements inline. See: https://mockasort-studio.github.io/hall-codex/how-to-invoke/"`
- **Options:** `"Yes, I'm an invoker"` / `"No, use local mode"`

**If "No":** write `.hall-cache/invoker.json` as `{"mode":"local","verified_at":"<ISO>","checks":{}}`. Set `local_mode: true` and `automation_level: 0` in `config.json`. Skip automation Q&A.

**If "Yes":** run verification:

```bash
ORG=$(echo "$REPO" | cut -d/ -f1)
```

Call `get_me` MCP → `ME` = returned `login` field.
`# On rate_limit/secondary-rate-limit error: ME=$(gh api /user --jq '.login')`

Call `search_repositories` MCP with query `repo:${ORG}/hall-of-automata`. `HALL_REPO=true` if results are non-empty; `false` otherwise.
`# On rate_limit/secondary-rate-limit error: gh api "repos/${ORG}/hall-of-automata" --silent && HALL_REPO=true || HALL_REPO=false`

Call `get_team_members` MCP with org=`$ORG`, team_slug=`automata-invokers`. Determine `TEAM_MEMBER`:
- Error response (403, not found, rate limit): `TEAM_MEMBER=unknown`
- `$ME` in returned members list: `TEAM_MEMBER=true`
- Otherwise: `TEAM_MEMBER=false`

`# On rate_limit/secondary-rate-limit error: TEAM_RAW=$(gh api "orgs/${ORG}/teams/automata-invokers/memberships/${ME}" --jq '.state'); case "$TEAM_RAW" in active|pending) TEAM_MEMBER=true ;; "") TEAM_MEMBER=unknown ;; *) TEAM_MEMBER=false ;; esac`

Decision:
- `HALL_REPO=false` → print "Hall not found in org ${ORG} — verify the Hall is set up at github.com/apps/hall-of-automata"; write `mode: local`; set `local_mode: true`, `automation_level: 0`
- `HALL_REPO=true` + `TEAM_MEMBER=false` → print "Hall found but you are not in automata-invokers — switching to local mode"; write `mode: local`; set `local_mode: true`, `automation_level: 0`
- `HALL_REPO=true` + `TEAM_MEMBER=unknown` → print "WARN: team membership unverifiable (token lacks read:org) — proceeding as invoker"; write `mode: invoker`; set `local_mode: false`
- `HALL_REPO=true` + `TEAM_MEMBER=true` → write `mode: invoker`; set `local_mode: false`

`invoker.json` schema:
```json
{
  "mode": "invoker | local",
  "verified_at": "<ISO timestamp>",
  "checks": {"hall_repo": true, "team_member": true}
}
```

Only write `.hall-cache/invoker.json` after the final decision — do not cache a partial result.

**Automation Q&A (invoker path only):** if `local_mode: false` was just set and `AUTO_LEVEL=missing`, use `AskUserQuestion`: Q1 — auto-review after each specialist PR? Q2 (if Q1=Yes) — auto-merge on LGTM? Map to level 0 (manual), 1 (review), 2 (full). Write `local_mode` and `automation_level` to `.hall-cache/session/config.json`.

### Step 7: Plans + invite

```bash
ls .hall-cache/plans/ 2>/dev/null || true
```

List existing plans with status. Ask whether to resume or start fresh. Then ask what the invoker wants to build — one sentence, in character as Old Major.
