---
name: hall-open
description: Enter Old Major session mode — build agent index, assemble session stack, activate
argument-hint: [--refresh|--verify]
allowed-tools: [Bash, Write, AskUserQuestion, CronCreate, mcp__github__get_file_contents, mcp__github__get_me, mcp__github__get_team_members, mcp__github__search_repositories]
---

# /hall:open

Enter Hall session mode. Builds agent index, assembles session stack, activates Old Major.

Use `--refresh` to force agent-index re-fetch even if SHA matches. Use `--verify` to force invoker re-check.

## Execution sequence

Execute each step in order. Hard-stop on any error; warn-and-continue on non-critical issues.

### Step 1: Preflight + diagnostics

**Flag pre-processing:**
- If `--verify` was passed: after deriving `$ORG` below, run `rm -f ~/.hall/$ORG/invoker.json`
- If `--refresh` was passed: treat `NEED_FETCH=true` regardless of the block output below.

```bash
set -euo pipefail

# Hard stops
gh auth status &>/dev/null || { echo "ERROR: gh not authenticated" >&2; exit 1; }

[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ] || echo "WARN: GITHUB_PERSONAL_ACCESS_TOKEN not set — MCP unavailable."

# Cache state
mkdir -p ~/.hall ~/.hall/session
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-$(cat ~/.hall/session/.plugin-root 2>/dev/null || echo "")}
if [ -n "$CLAUDE_PLUGIN_ROOT" ]; then
  export CLAUDE_PLUGIN_ROOT
  printf '%s' "$CLAUDE_PLUGIN_ROOT" > ~/.hall/session/.plugin-root
fi

# Path derivation — .repo-slug is the source of truth; picker is the only fallback
REPO=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
SLUG="${REPO##*/}"
ORG="${REPO%%/*}"
if [ -n "$REPO" ]; then
  REPO_NAME="$SLUG"
  echo "Using project: $SLUG"
  mkdir -p ~/.hall/$REPO/plans
fi
echo "ORG=$ORG"
```

If `CLAUDE_PLUGIN_ROOT` is still empty, find the harness-injected `Base directory for this skill: <path>` line, strip `/skills/hall-open`, then `printf '%s' "<path>" > ~/.hall/session/.plugin-root && export CLAUDE_PLUGIN_ROOT="<path>"`. If absent: `echo "WARN: CLAUDE_PLUGIN_ROOT could not be derived — run /hall:open from within the plugin repo or after setup.py has run once."`

Call `get_file_contents` MCP: owner=`$ORG`, repo=`hall-of-automata`, path=`agents.json`. Extract `sha` → `CURRENT_SHA`. After extracting the SHA from the MCP response, write it to disk immediately using a single bash command (substitute `<SHA>` with the actual value):
```bash
printf '%s' "<SHA>" > ~/.hall/session/.current-sha
```
`# On rate_limit/secondary-rate-limit error: gh api repos/$ORG/hall-of-automata/contents/agents.json --jq '.sha'`

```bash
CURRENT_SHA=$(cat ~/.hall/session/.current-sha 2>/dev/null || echo "")
CACHED_SHA=$(cat ~/.hall/agent-index.sha 2>/dev/null || echo "")

NEED_FETCH=false
[ "$CURRENT_SHA" != "$CACHED_SHA" ] && NEED_FETCH=true
python3 -c "import json, os; d=json.load(open(os.path.expanduser('~/.hall/agent-index.json'))); assert isinstance(d,dict)" 2>/dev/null \
  || NEED_FETCH=true

ACTIVE_PLAN=false
if HALL_REPO="$REPO" python3 -c "
import json, glob, os, sys
repo = os.environ.get('HALL_REPO', '')
found = any(
    any(t.get('status') in ('DISPATCHED', 'IN_PROGRESS') for t in json.load(open(f)).get('tasks', []))
    for f in glob.glob(os.path.expanduser('~/.hall/' + repo + '/plans/*/plan.json'))
)
sys.exit(0 if found else 1)
" 2>/dev/null; then
  ACTIVE_PLAN=true
fi

AUTO_LEVEL=$(python3 -c "import json, os; repo='$REPO'; print(json.load(open(os.path.expanduser(f'~/.hall/{repo}/config.json'))).get('automation_level','missing'))" \
  2>/dev/null || echo "missing")

echo "NEED_FETCH=$NEED_FETCH | ACTIVE_PLAN=$ACTIVE_PLAN | AUTO_LEVEL=$AUTO_LEVEL"
echo "CONTEXT_EXISTS=$([ -f ~/.hall/$REPO/context.md ] && echo true || echo false)"
echo "SHA=${CURRENT_SHA:0:8}"
```

If `REPO` is empty (no `.repo-slug`): read `skills/hall-open/standalone-flow.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the org/repo resolution procedure exactly as specified. On completion, `ORG`, `REPO_NAME`, `REPO`, and `SLUG` are set.

Read `$CLAUDE_PLUGIN_ROOT/methodology/old-major-cli.md` directly from the plugin and adopt its contents as operating instructions for this session:
```bash
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-$(cat ~/.hall/session/.plugin-root 2>/dev/null || echo "")}
cat "$CLAUDE_PLUGIN_ROOT/methodology/old-major-cli.md"
```

### Step 2: Agent index build (skip if NEED_FETCH=false)

Read `CURRENT_SHA` from `~/.hall/session/.current-sha`; if absent, call `get_file_contents` MCP (owner=`$ORG`, repo=`hall-of-automata`, path=`agents.json`) and extract `sha`.
`# On rate_limit/secondary-rate-limit error: gh api repos/$ORG/hall-of-automata/contents/agents.json --jq '.sha'`

Call `get_file_contents` MCP: owner=`$ORG`, repo=`hall-of-automata`, path=`agents.json`. Extract `content` (base64-encoded). Substitute `<base64-content>` and run:
`# On rate_limit/secondary-rate-limit error: BASE64_CONTENT=$(gh api repos/$ORG/hall-of-automata/contents/agents.json --jq '.content'); then substitute as <base64-content> below`

```bash
python3 << 'PYEOF'
import json, os, base64
content_b64 = "<base64-content>"
catalog = json.loads(base64.b64decode(content_b64)).get('agents', {})
roster = {}
for slug, data in catalog.items():
    if slug == 'old-major':
        continue
    c = data.get('catalog', {})
    roster[slug] = {
        'display_name': data.get('display_name', slug),
        'roles': c.get('roles', []),
        'domains': c.get('domains', []),
        'scope_summary': c.get('scope_summary', '').strip(),
        'model': data.get('model', ''),
    }
json.dump(roster, open(os.path.expanduser('~/.hall/agent-index.json'), 'w'), indent=2)
print(f'Agent index: {len(roster)} specialists.')
PYEOF
```

```bash
CURRENT_SHA=$(cat ~/.hall/session/.current-sha 2>/dev/null || echo "")
CURRENT_SHA="$CURRENT_SHA" python3 "$CLAUDE_PLUGIN_ROOT/scripts/verify-personas.py"
```

**`--refresh` limitation:** Stack changes regenerated in `--refresh` don't take effect in the current context window — the @-import chain is evaluated only at conversation start. A fresh `cc` session is required for agent index or methodology changes to apply. See Step 5.

### Step 3: Setup — methodology, overlays, stack

Read `skills/hall-open/session-setup.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the session setup procedure exactly as specified.

### Step 4: Context synthesis (only if CONTEXT_EXISTS=false)

Read the first 30 lines of `README.md` and synthesise a 2–4 sentence brief. Write it to `~/.hall/$SLUG/context.md` using Bash — the Write tool fails on new files. Use printf or a heredoc:
```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
cat > "$HOME/.hall/$SLUG/context.md" << 'CTXEOF'
<synthesised brief here>
CTXEOF
```
If no README exists: write `Project context: not available.`

Call `get_file_contents` MCP (owner=`$ORG`, repo=`$REPO_NAME`, path=`CLAUDE.md`). On success, write decoded content to `~/.hall/context/target-claude.md`; incorporate as supplemental project context in `context.md`. On 404: skip silently; synthesise from README only.

### Step 5: Context injection

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
if [ -n "$SLUG" ]; then
  STACK_PATH=~/.hall/$SLUG/session/CLAUDE-stack.md
else
  STACK_PATH=~/.hall/session/CLAUDE-stack.md
fi
```

Read `$STACK_PATH` and each @-imported file in order; apply as operating instructions. Skip if `resume` mode and `--refresh` was not passed — stack already loaded via SessionStart hook. On `--refresh`: always run this step regardless of mode; @-import chains are not re-evaluated mid-session, so the explicit read makes regenerated stack content active immediately.

### Step 6: Invoker verification gate

Skip this step if `~/.hall/$ORG/invoker.json` exists and contains `mode: invoker`. Otherwise, read `skills/hall-open/invoker-gate.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the invoker verification procedure exactly as specified. If verification fails, `/hall:open` halts there — do not proceed to Step 7.

### Step 7: Plans + invite

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
ls ~/.hall/$SLUG/plans/ 2>/dev/null || true
```

List existing plans with status. Ask whether to resume or start fresh. Then ask what the invoker wants to build — one sentence, in character as Old Major.
