---
name: hall-open
description: Enter Old Major session mode — build agent index, activate
argument-hint: [--refresh|--verify]
allowed-tools: [Bash, AskUserQuestion, CronCreate, mcp__github__get_file_contents, mcp__github__get_me, mcp__github__get_team_members, mcp__github__search_repositories]
---

# /hall:open

Enter Hall session mode. Builds agent index, activates Old Major.

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

mkdir -p ~/.hall
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-$(cat ~/.hall/plugin-root 2>/dev/null || echo "")}
if [ -n "$CLAUDE_PLUGIN_ROOT" ]; then
  export CLAUDE_PLUGIN_ROOT
  printf '%s' "$CLAUDE_PLUGIN_ROOT" > ~/.hall/plugin-root
fi

# Path derivation — .repo-slug is the source of truth; picker is the only fallback
REPO=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
SLUG="${REPO##*/}"
ORG="${REPO%%/*}"
[ -n "$REPO" ] && REPO_NAME="$SLUG" && echo "Using project: $SLUG"
echo "ORG=$ORG"
```

If `CLAUDE_PLUGIN_ROOT` is still empty, find the harness-injected `Base directory for this skill: <path>` line, strip `/skills/hall-open`, then `printf '%s' "<path>" > ~/.hall/plugin-root && export CLAUDE_PLUGIN_ROOT="<path>"`. If absent: `echo "WARN: CLAUDE_PLUGIN_ROOT could not be derived — run /hall:open from within the plugin repo or after setup.py has run once."`

Call `get_file_contents` MCP: owner=`$ORG`, repo=`hall-of-automata`, path=`agents.json`. Extract `sha` → `CURRENT_SHA`. After extracting the SHA from the MCP response, write it to disk immediately using a single bash command (substitute `<SHA>` with the actual value) — this is scratch state to carry the value across tool calls within this run, not a persisted artifact:
```bash
printf '%s' "<SHA>" > ~/.hall/.current-sha
```
`# On rate_limit/secondary-rate-limit error: gh api repos/$ORG/hall-of-automata/contents/agents.json --jq '.sha'`

```bash
CURRENT_SHA=$(cat ~/.hall/.current-sha 2>/dev/null || echo "")
CACHED_SHA=$(cat ~/.hall/agent-index.sha 2>/dev/null || echo "")

NEED_FETCH=false
[ "$CURRENT_SHA" != "$CACHED_SHA" ] && NEED_FETCH=true
python3 -c "import json, os; d=json.load(open(os.path.expanduser('~/.hall/agent-index.json'))); assert isinstance(d,dict)" 2>/dev/null \
  || NEED_FETCH=true

echo "NEED_FETCH=$NEED_FETCH"
echo "SHA=${CURRENT_SHA:0:8}"
```

If `REPO` is empty (no `.repo-slug`): read `skills/hall-open/repo-picker.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the org/repo resolution procedure exactly as specified. On completion, `ORG`, `REPO_NAME`, `REPO`, and `SLUG` are set.

Only now is `$REPO` guaranteed resolved — read `AUTO_LEVEL` here, never earlier (an empty `$REPO` would resolve to a hall-root `config.json`, which must never exist):
```bash
AUTO_LEVEL=$(python3 -c "import json, os; repo='$REPO'; print(json.load(open(os.path.expanduser(f'~/.hall/{repo}/config.json'))).get('automation_level','missing'))" \
  2>/dev/null || echo "missing")
echo "AUTO_LEVEL=$AUTO_LEVEL"
```

Read `$CLAUDE_PLUGIN_ROOT/methodology/old-major-cli.md` directly from the plugin and adopt its contents as operating instructions for this session:
```bash
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-$(cat ~/.hall/plugin-root 2>/dev/null || echo "")}
cat "$CLAUDE_PLUGIN_ROOT/methodology/old-major-cli.md"
```

### Step 2: Agent index build (skip if NEED_FETCH=false)

Read `CURRENT_SHA` from `~/.hall/.current-sha`; if absent, call `get_file_contents` MCP (owner=`$ORG`, repo=`hall-of-automata`, path=`agents.json`) and extract `sha`.
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
CURRENT_SHA=$(cat ~/.hall/.current-sha 2>/dev/null || echo "")
CURRENT_SHA="$CURRENT_SHA" python3 "$CLAUDE_PLUGIN_ROOT/scripts/verify-personas.py"
```

### Step 3: Setup — project directory, cron

Read `skills/hall-open/session-setup.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the session setup procedure exactly as specified.

### Step 4: Invoker verification gate

Skip this step if `~/.hall/$ORG/invoker.json` exists and contains `mode: invoker`. Otherwise, read `skills/hall-open/invoker-gate.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the invoker verification procedure exactly as specified. If verification fails, `/hall:open` halts there — do not proceed to Step 5.

### Step 5: Board + invite

Check Claude memory for any notes saved about `$REPO` and surface relevant context before proceeding.

`config.json`'s `board_project_number` is a cached anchor, not the source of truth — GitHub is. Verify live whether the repo actually has a linked Projects v2 board and a wiki, rather than concluding "no board" from an empty or missing local key:

```bash
LIVE_BOARD=$(gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      projectsV2(first: 5) { nodes { number title } }
    }
  }' -f owner="$ORG" -f repo="$SLUG" --jq '.data.repository.projectsV2.nodes[0].number // empty' 2>/dev/null)
HAS_WIKI=$(gh api "repos/$REPO" --jq '.has_wiki' 2>/dev/null || echo "false")
echo "LIVE_BOARD=$LIVE_BOARD | HAS_WIKI=$HAS_WIKI"
```

If `$LIVE_BOARD` is non-empty and differs from (or is missing from) `config.json`'s `board_project_number`, backfill `config.json` from the live value before rendering — the cache should mirror GitHub, never override it. If `$LIVE_BOARD` is empty, there is no board regardless of what `config.json` says; do not render one.

If `$LIVE_BOARD` is non-empty: read `skills/hall-status/SKILL.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and render the live board.

If `$HAS_WIKI` is `false`: note in the greeting that no saga wiki exists yet for this repo — `hall-saga` will offer to enable it when initiative-sized work comes up.

Ask what the invoker wants to build — one sentence, in character as Old Major.
