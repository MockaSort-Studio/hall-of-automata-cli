---
name: hall-open
description: Enter Old Major session mode — fetch personas, assemble session stack, activate
argument-hint: [--refresh]
allowed-tools: [Bash, Write, CronCreate, AskUserQuestion]
---

# /hall:open

Enter Hall session mode. Fetches personas, assembles session stack, activates Old Major.

Use `--refresh` to force persona re-fetch even if cache is fresh.

## Execution sequence

Execute each step in order. Hard-stop on any error; warn-and-continue on non-critical issues.

### Step 1: Preflight + diagnostics

```bash
set -euo pipefail

# Hard stops
gh auth status &>/dev/null || { echo "ERROR: gh not authenticated" >&2; exit 1; }
REPO=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]||;s|\.git$||')
gh api "repos/${REPO}/installation" --silent --jq '.id' &>/dev/null \
  || { echo "ERROR: Hall App not installed — see github.com/apps/hall-of-automata" >&2; exit 1; }

[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ] || echo "WARN: GITHUB_PERSONAL_ACCESS_TOKEN not set — MCP unavailable."

# Gitignore
grep -q "\.hall-cache" .gitignore 2>/dev/null \
  || { echo ".hall-cache/" >> .gitignore; echo "Added .hall-cache/ to .gitignore"; }

# Cache state
mkdir -p .hall-cache/personas .hall-cache/session .hall-cache/plans

CURRENT_SHA=$(gh api repos/MockaSort-Studio/hall-of-automata/contents/agents.yml \
  --jq '.sha' 2>/dev/null || echo "")
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

echo "$CURRENT_SHA" > .hall-cache/session/.current-sha
echo "NEED_FETCH=$NEED_FETCH | ACTIVE_PLAN=$ACTIVE_PLAN | AUTO_LEVEL=$AUTO_LEVEL"
echo "CONTEXT_EXISTS=$([ -f .hall-cache/session/context.md ] && echo true || echo false)"
echo "SHA=${CURRENT_SHA:0:8}"
```

If `--refresh` was passed, treat `NEED_FETCH=true` regardless of the output above.

### Step 2: Persona fetch (skip if NEED_FETCH=false)

```bash
CURRENT_SHA=$(cat .hall-cache/session/.current-sha 2>/dev/null || \
  gh api repos/MockaSort-Studio/hall-of-automata/contents/agents.yml --jq '.sha' 2>/dev/null || echo "")

gh api repos/MockaSort-Studio/hall-of-automata/contents/roster \
  --jq '[.[] | select(.type=="file" and (.name|endswith(".md")) and .name!="old-major.md" and .name!="README.md") | .name[:-3]]' \
  > .hall-cache/personas/.advisory-roster.json
python3 -c "import json,sys; d=json.load(open('.hall-cache/personas/.advisory-roster.json')); assert isinstance(d,list), f'API error: {d}'" \
  || exit 1

gh api repos/MockaSort-Studio/hall-of-automata/contents/agents/automaton_base.md \
  --jq '.content' | base64 -d > .hall-cache/personas/automaton_base.md &
gh api repos/MockaSort-Studio/hall-of-automata/contents/roster/old-major.md \
  --jq '.content' | base64 -d > .hall-cache/personas/old-major.md &
while IFS= read -r S; do
  (gh api "repos/MockaSort-Studio/hall-of-automata/contents/roster/${S}.md" \
    --jq '.content' | base64 -d > ".hall-cache/personas/${S}.md") &
done < <(python3 -c "import json; [print(s) for s in json.load(open('.hall-cache/personas/.advisory-roster.json'))]")
wait

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
print(f'Setup complete (mode={mode}).')
PYEOF

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

### Step 6: Cron (only if ACTIVE_PLAN=true)

Call `CronCreate` with schedule `*/5 * * * *` and prompt: `"Autonomous plan advancement (cron): drain .hall-cache/watcher-events.jsonl then run /hall:reconcile. Dispatch newly unlocked tasks without confirmation. Append one-line summary to .hall-cache/cron-log.md."` Store the ID:

```bash
python3 -c "import json; open('.hall-cache/session/cron.json','w').write(json.dumps({'cron_id':'<ID>','created_at':'<ISO>'},indent=2))"
```

### Step 7: Automation config (only if AUTO_LEVEL=missing)

Use `AskUserQuestion`: Q1 — auto-review after each specialist PR? Q2 (if Q1=Yes) — auto-merge on LGTM? Map to level 0 (manual), 1 (review), 2 (full). Write to `.hall-cache/session/config.json`.

### Step 8: Plans + invite

```bash
ls .hall-cache/plans/ 2>/dev/null || true
```

List existing plans with status. Ask whether to resume or start fresh. Then ask what the invoker wants to build — one sentence, in character as Old Major.
