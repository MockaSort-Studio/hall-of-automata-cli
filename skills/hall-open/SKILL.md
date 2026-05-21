---
name: hall-open
description: Enter Old Major session mode — fetch personas, assemble session stack, activate
argument-hint: [--refresh|--verify]
allowed-tools: [Bash, Write, AskUserQuestion, CronCreate, mcp__github__get_file_contents, mcp__github__get_me, mcp__github__get_team_members, mcp__github__search_repositories, mcp__hall-projects__read_board]
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
CURRENT_SHA="$CURRENT_SHA" python3 "$CLAUDE_PLUGIN_ROOT/scripts/verify-personas.py"
```

**`--refresh` limitation:** Stack changes regenerated in `--refresh` don't take effect in the current context window — the @-import chain is evaluated only at conversation start. A fresh `cc` session is required for persona or methodology changes to apply. See Step 5.

### Step 3: Setup — methodology, overlays, stack, watcher

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/hall-open-setup.py"
```

**Cron restart (resume with in-flight tasks):**

```bash
python3 << 'PYEOF'
import json, glob, sys
found = any(
    any(t.get('status') in ('DISPATCHED', 'IN_PROGRESS') for t in json.load(open(f)).get('tasks', []))
    for f in glob.glob('.hall-cache/plans/*/plan.json')
)
sys.exit(0 if found else 1)
PYEOF
&& INFLIGHT=true || INFLIGHT=false
CRON_EXISTS=$([ -f .hall-cache/session/cron.json ] && echo true || echo false)
echo "INFLIGHT=$INFLIGHT | CRON_EXISTS=$CRON_EXISTS"
```

If `INFLIGHT=true` and `CRON_EXISTS=false`: call `CronCreate` with `schedule=*/15 * * * *` and `prompt="Autonomous plan advancement (cron): drain .hall-cache/watcher-events.jsonl then run /hall:reconcile. If any task has needs_review: true after reconcile, run /hall:review. If newly unlocked READY tasks exist, dispatch them without confirmation. Append one-line summary to .hall-cache/cron-log.md."` Then write the returned cron ID:

```python
import json
from datetime import datetime, timezone
cron_id = "<returned cron ID>"
json.dump(
    {"cron_id": cron_id, "created_at": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    open('.hall-cache/session/cron.json', 'w')
)
print('Cron restarted (in-flight tasks detected).')
```

**Board context:** Read `board_project_number` from `.hall-cache/session/config.json`. If absent, skip silently.

```bash
BOARD_NUM=$(python3 -c "import json; print(json.load(open('.hall-cache/session/config.json')).get('board_project_number',''))" 2>/dev/null || echo "")
OWNER=$(echo "$REPO" | cut -d/ -f1)
```

If `BOARD_NUM` is non-empty: call `read_board` MCP with `owner=$OWNER` and `project_number=$BOARD_NUM` (integer). On success, format `board-context.md`:

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/format-board-context.py"
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
if [ -n "$WPID" ] && ps -p "$WPID" -o comm= 2>/dev/null | grep -q watcher; then
  echo "Watcher OK (PID $WPID)."
else
  nohup bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/watcher.sh" &> .hall-cache/watcher.log &
  echo "Watcher started."
fi
```

### Step 4: Context synthesis (only if CONTEXT_EXISTS=false)

Read the first 30 lines of `README.md` and write a 2–4 sentence brief to `.hall-cache/session/context.md`. If no README: `Project context: not available.`

### Step 5: Context injection

Read `.hall-cache/session/CLAUDE-stack.md` and each @-imported file in order; apply as operating instructions. Skip if `resume` mode and `--refresh` was not passed — stack already loaded via CLAUDE.md @-imports. On `--refresh`: always run this step regardless of mode; @-import chains are not re-evaluated mid-session, so the explicit read makes regenerated stack content active immediately.

### Step 6: Invoker detection gate (only if LOCAL_MODE=missing)

Read `skills/hall-open/invoker-gate.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the invoker detection procedure exactly as specified.

### Step 7: Plans + invite

```bash
ls .hall-cache/plans/ 2>/dev/null || true
```

List existing plans with status. Ask whether to resume or start fresh. Then ask what the invoker wants to build — one sentence, in character as Old Major.
