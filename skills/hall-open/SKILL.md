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
- If `--verify` was passed: `rm -f ~/.hall/invoker.json`
- If `--refresh` was passed: treat `NEED_FETCH=true` regardless of the block output below.

```bash
set -euo pipefail

# Hard stops
gh auth status &>/dev/null || { echo "ERROR: gh not authenticated" >&2; exit 1; }
ORIGIN=$(git remote get-url origin 2>/dev/null || echo "")
STANDALONE=$([ -z "$ORIGIN" ] && echo true || echo false)
if [ "$STANDALONE" = "false" ]; then
  REPO=$(echo "$ORIGIN" | sed 's|.*github.com[:/]||;s|\.git$||')
fi

[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ] || echo "WARN: GITHUB_PERSONAL_ACCESS_TOKEN not set — MCP unavailable."

# Cache state
mkdir -p ~/.hall/personas ~/.hall/session
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-$(cat ~/.hall/session/.plugin-root 2>/dev/null || echo "")}
[ -n "$CLAUDE_PLUGIN_ROOT" ] || echo "WARN: CLAUDE_PLUGIN_ROOT could not be derived — run /hall:open from within the plugin repo or after setup.py has run once."

# Slug derivation
if [ "$STANDALONE" = "false" ]; then
  SLUG=$(echo "$ORIGIN" | sed 's|.*github.com[:/]||;s|\.git$||' | cut -d/ -f2)
else
  SLUG=$(python3 -c "
import json, os
try:
    print(json.load(open(os.path.expanduser('~/.hall/.config.json'))).get('target_repo','').split('/')[-1])
except Exception:
    print('')
" 2>/dev/null || echo "")
fi
[ -n "$SLUG" ] && mkdir -p ~/.hall/projects/$SLUG/plans
[ -n "$SLUG" ] && echo -n "$SLUG" > ~/.hall/session/.repo-slug
```

Call `get_file_contents` MCP: owner=`MockaSort-Studio`, repo=`hall-of-automata`, path=`agents.yml`. Extract `sha` → `CURRENT_SHA`. After extracting the SHA from the MCP response, write it to disk immediately using a single bash command (substitute `<SHA>` with the actual value):
```bash
printf '%s' "<SHA>" > ~/.hall/session/.current-sha
```
`# On rate_limit/secondary-rate-limit error: gh api repos/MockaSort-Studio/hall-of-automata/contents/agents.yml --jq '.sha'`

```bash
CURRENT_SHA=$(cat ~/.hall/session/.current-sha 2>/dev/null || echo "")
CACHED_SHA=$(cat ~/.hall/personas/.agents-yml-sha 2>/dev/null || echo "")
FETCHED_AT=$(cat ~/.hall/personas/.fetched_at 2>/dev/null || echo "")
NOW=$(date +%s)
FETCHED_TS=$([ -n "$FETCHED_AT" ] && date -d "$FETCHED_AT" +%s 2>/dev/null || echo "0")

NEED_FETCH=false
[ "$CURRENT_SHA" != "$CACHED_SHA" ] && NEED_FETCH=true
[ $(( NOW - FETCHED_TS )) -gt 86400 ] && NEED_FETCH=true
[ -z "$FETCHED_AT" ] && NEED_FETCH=true
python3 -c "import json, os; d=json.load(open(os.path.expanduser('~/.hall/personas/.advisory-roster.json'))); assert isinstance(d,list)" 2>/dev/null \
  || NEED_FETCH=true

ACTIVE_PLAN=false
if HALL_SLUG="$SLUG" python3 -c "
import json, glob, os, sys
slug = os.environ.get('HALL_SLUG', '')
found = any(
    any(t.get('status') in ('DISPATCHED', 'IN_PROGRESS') for t in json.load(open(f)).get('tasks', []))
    for f in glob.glob(os.path.expanduser('~/.hall/projects/' + slug + '/plans/*/plan.json'))
)
sys.exit(0 if found else 1)
" 2>/dev/null; then
  ACTIVE_PLAN=true
fi

AUTO_LEVEL=$(python3 -c "import json, os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/config.json'))).get('automation_level','missing'))" \
  2>/dev/null || echo "missing")
LOCAL_MODE=$(python3 -c "import json, os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/config.json'))).get('local_mode','missing'))" \
  2>/dev/null || echo "missing")

echo "STANDALONE=$STANDALONE | NEED_FETCH=$NEED_FETCH | ACTIVE_PLAN=$ACTIVE_PLAN | AUTO_LEVEL=$AUTO_LEVEL | LOCAL_MODE=$LOCAL_MODE"
echo "CONTEXT_EXISTS=$([ -f ~/.hall/projects/$SLUG/context.md ] && echo true || echo false)"
echo "SHA=${CURRENT_SHA:0:8}"
```

If `STANDALONE=true`: read `skills/hall-open/standalone-flow.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the org/repo resolution procedure exactly as specified. On completion, `ORG`, `REPO_NAME`, and `REPO` are set for subsequent steps.

### Step 2: Persona fetch (skip if NEED_FETCH=false)

Read `CURRENT_SHA` from `~/.hall/session/.current-sha`; if absent, call `get_file_contents` MCP (owner=`MockaSort-Studio`, repo=`hall-of-automata`, path=`agents.yml`) and extract `sha`.
`# On rate_limit/secondary-rate-limit error: gh api repos/MockaSort-Studio/hall-of-automata/contents/agents.yml --jq '.sha'`

Call `get_file_contents` MCP: owner=`MockaSort-Studio`, repo=`hall-of-automata`, path=`roster/`. From the returned array, keep entries where type=`file`, name ends in `.md`, name ≠ `old-major.md` and ≠ `README.md`. Write the names (without `.md`) using:
```bash
python3 -c "import json, os; open(os.path.expanduser('~/.hall/personas/.advisory-roster.json'), 'w').write(json.dumps([...]))"
```
(substitute `[...]` with the filtered list of name strings from the MCP result, e.g. `['snowball', 'hamlet', 'pyrate']`)
`# On rate_limit/secondary-rate-limit error: gh api repos/MockaSort-Studio/hall-of-automata/contents/roster --jq '[.[] | select(.type=="file" and (.name|endswith(".md")) and .name!="old-major.md" and .name!="README.md") | .name[:-3]]' > ~/.hall/personas/.advisory-roster.json`

```bash
python3 -c "import json,sys, os; d=json.load(open(os.path.expanduser('~/.hall/personas/.advisory-roster.json'))); assert isinstance(d,list), f'API error: {d}'" \
  || exit 1
```

Fetch and write persona files via Bash (the Write tool fails on new files; gh api writes directly):

```bash
SPECS=$(python3 -c "import json, os; print(' '.join(json.load(open(os.path.expanduser('~/.hall/personas/.advisory-roster.json')))))")
gh api repos/MockaSort-Studio/hall-of-automata/contents/agents/automaton_base.md \
  --jq '.content' | base64 -d > ~/.hall/personas/automaton_base.md
gh api repos/MockaSort-Studio/hall-of-automata/contents/roster/old-major.md \
  --jq '.content' | base64 -d > ~/.hall/personas/old-major.md
for name in $SPECS; do
  gh api "repos/MockaSort-Studio/hall-of-automata/contents/roster/${name}.md" \
    --jq '.content' | base64 -d > "$HOME/.hall/personas/${name}.md"
done
```

```bash
CURRENT_SHA=$(cat ~/.hall/session/.current-sha 2>/dev/null || echo "")
CURRENT_SHA="$CURRENT_SHA" python3 "$CLAUDE_PLUGIN_ROOT/scripts/verify-personas.py"
```

**`--refresh` limitation:** Stack changes regenerated in `--refresh` don't take effect in the current context window — the @-import chain is evaluated only at conversation start. A fresh `cc` session is required for persona or methodology changes to apply. See Step 5.

### Step 3: Setup — methodology, overlays, stack

Read `skills/hall-open/session-setup.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the session setup procedure exactly as specified.

### Step 4: Context synthesis (only if CONTEXT_EXISTS=false)

Read the first 30 lines of `README.md` and synthesise a 2–4 sentence brief. Write it to `~/.hall/projects/$SLUG/context.md` using Bash — the Write tool fails on new files. Use printf or a heredoc:
```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
cat > "$HOME/.hall/projects/$SLUG/context.md" << 'CTXEOF'
<synthesised brief here>
CTXEOF
```
If no README exists: write `Project context: not available.`

**Standalone mode:** if `STANDALONE=true`, call `get_file_contents` MCP (owner=`$ORG`, repo=`$REPO_NAME`, path=`CLAUDE.md`). On success, write decoded content to `~/.hall/context/target-claude.md`; incorporate as supplemental project context in `context.md`. On 404: skip silently; synthesise from README only.

### Step 5: Context injection

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
if [ -n "$SLUG" ]; then
  STACK_PATH=~/.hall/projects/$SLUG/session/CLAUDE-stack.md
else
  STACK_PATH=~/.hall/session/CLAUDE-stack.md
fi
```

Read `$STACK_PATH` and each @-imported file in order; apply as operating instructions. Skip if `resume` mode and `--refresh` was not passed — stack already loaded via SessionStart hook. On `--refresh`: always run this step regardless of mode; @-import chains are not re-evaluated mid-session, so the explicit read makes regenerated stack content active immediately.

### Step 6: Invoker detection gate

Skip this step if EITHER condition holds: (a) `LOCAL_MODE` is not `missing`, OR (b) `~/.hall/invoker.json` exists and contains a valid `mode` (`invoker` or `local`). If neither condition holds, read `skills/hall-open/invoker-gate.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the invoker detection procedure exactly as specified.

### Step 7: Plans + invite

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
ls ~/.hall/projects/$SLUG/plans/ 2>/dev/null || true
```

List existing plans with status. Ask whether to resume or start fresh. Then ask what the invoker wants to build — one sentence, in character as Old Major.
