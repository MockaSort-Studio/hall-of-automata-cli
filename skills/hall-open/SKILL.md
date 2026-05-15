---
name: hall-open
description: Enter Old Major session mode — fetch personas, assemble session stack, activate
argument-hint: [--refresh]
allowed-tools: [Bash, Read, Write]
---

# /hall:open

Enter Hall session mode. Fetches personas from the Hall roster, assembles the Old Major session stack, and activates it in the current session.

Use `--refresh` to force a persona re-fetch even if the cache is fresh.

## Execution sequence

Execute each step in order. Stop and report clearly if any step fails.

### Step 1: Preflight

Run the same checks as `/hall:doctor`. Hard-stop on:
- gh not authenticated
- Hall App not installed on this repo's org

Warn and continue on:
- `GITHUB_PERSONAL_ACCESS_TOKEN` not set (MCP won't connect; gh CLI still works)
- User not in invoker pool (note: plan-only mode, no dispatch)

### Step 2: Gitignore

```bash
if ! grep -q "\.hall-cache" .gitignore 2>/dev/null; then
  echo ".hall-cache/" >> .gitignore
  echo "Added .hall-cache/ to .gitignore"
fi
```

### Step 2.5: Synthesise project context

```bash
mkdir -p .hall-cache/session
```

Read these files from the current working directory if they exist:
- `README.md`
- `CLAUDE.md` — omit any line starting with `@.hall-cache/session/`
- `docs/design.md` — first 80 lines only

Synthesise a 2–4 sentence context brief: what this project is, its primary tech stack, and any orchestration-relevant constraints. Write it to `.hall-cache/session/context.md`.

If none of the three files exist, write: `Project context: not available — no README, CLAUDE.md, or docs/design.md found.`

### Step 2.6: Unattended permissions

Check whether `.claude/settings.json` is present in the workspace.

```bash
if [ ! -f .claude/settings.json ]; then
  mkdir -p .claude
  PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
  sed "s|HALL_CLI_PLUGIN_ROOT|${PLUGIN_ROOT}|g" \
    "${PLUGIN_ROOT}/templates/claude-settings.json" > .claude/settings.json
  chmod +x "${PLUGIN_ROOT}/hooks/scripts/statusline.sh" \
            "${PLUGIN_ROOT}/hooks/scripts/hall-banner.sh"
  echo "Configured unattended permissions + status line."
  echo "NOTE: permissions take effect on next session start — this session is not fully unattended."
else
  echo "Unattended permissions already configured."
fi
```


### Step 3: Persona fetch

Check cache freshness:
```bash
FETCHED_AT=$(cat .hall-cache/personas/.fetched_at 2>/dev/null || echo "")
NOW=$(date +%s)
```

If `--refresh` was passed OR `$FETCHED_AT` is empty OR it's >86400 seconds old, fetch:

```bash
mkdir -p .hall-cache/personas

# Discover advisory specialists first (needed to know what to fetch in parallel).
# Excludes old-major.md and README.md — those are not advisory specialist personas.
gh api repos/MockaSort-Studio/hall-of-automata/contents/roster \
  --jq '[.[] | select(.type=="file" and (.name | endswith(".md")) and .name != "old-major.md" and .name != "README.md") | .name[:-3]]' \
  > .hall-cache/personas/.advisory-roster.json

# Fetch core files and all specialist personas in parallel.
gh api repos/MockaSort-Studio/hall-of-automata/contents/agents/automaton_base.md \
  --jq '.content' | base64 -d > .hall-cache/personas/automaton_base.md &
gh api repos/MockaSort-Studio/hall-of-automata/contents/roster/old-major.md \
  --jq '.content' | base64 -d > .hall-cache/personas/old-major.md &
while IFS= read -r SPECIALIST; do
  (gh api "repos/MockaSort-Studio/hall-of-automata/contents/roster/${SPECIALIST}.md" \
    --jq '.content' | base64 -d > ".hall-cache/personas/${SPECIALIST}.md") &
done < <(python3 -c "import json; [print(s) for s in json.load(open('.hall-cache/personas/.advisory-roster.json'))]")
wait

# Build compact roster index (replaces loading all personas at session start).
python3 << 'PYEOF'
import json
specialists = json.load(open('.hall-cache/personas/.advisory-roster.json'))
lines = ['# Advisory Specialist Roster', '']
for name in specialists:
    with open(f'.hall-cache/personas/{name}.md') as f:
        content = f.read()
    heading = next((l.lstrip('# ').strip() for l in content.splitlines() if l.startswith('#')), name)
    lines.append(f'- **{name}** (`hall:{name}`): {heading}')
lines.append('\nFull personas at `.hall-cache/personas/<name>.md`. Load via Tier 2 subagent when needed.')
open('.hall-cache/session/roster-index.md', 'w').write('\n'.join(lines))
PYEOF
echo "  Generated roster index."

date -u +"%Y-%m-%dT%H:%M:%SZ" > .hall-cache/personas/.fetched_at
echo "Personas fetched and cached."
```

After fetching (or confirming cache is fresh), reconcile the `agents.yml` SHA:

```bash
CURRENT_SHA=$(gh api repos/MockaSort-Studio/hall-of-automata/contents/agents.yml \
  --jq '.sha' 2>/dev/null || echo "")
CACHED_SHA=$(cat .hall-cache/personas/.agents-yml-sha 2>/dev/null || echo "")
```

If `$CURRENT_SHA != $CACHED_SHA` (or either is empty):
- Force a full persona re-fetch (run the fetch block above regardless of TTL).
- Write `$CURRENT_SHA` to `.hall-cache/personas/.agents-yml-sha`.
- Print: `agents.yml changed — refreshed persona cache.`

If they match:
- Skip re-fetch.
- Write `$CURRENT_SHA` to `.hall-cache/personas/.agents-yml-sha`.
- Print: `agents.yml unchanged (SHA: ${CURRENT_SHA:0:8}).`

### Step 4: Methodology copy

```bash
mkdir -p .hall-cache/methodology
cp "${CLAUDE_PLUGIN_ROOT}/methodology/"*.md .hall-cache/methodology/
```

### Step 5: Subagent generation

For each advisory specialist discovered in Step 3, render the generic overlay template.
`{{SPECIALIST_DESCRIPTION}}` is extracted from the first heading line in the specialist's persona file.

```bash
mkdir -p .hall-cache/session/claude-agents

python3 << 'PYEOF'
import json, os

specialists = json.load(open('.hall-cache/personas/.advisory-roster.json'))
plugin_root = os.environ.get('CLAUDE_PLUGIN_ROOT', '/home/mike/Workspace/hall-of-automata-cli')

with open(f'{plugin_root}/templates/subagent-overlay.md.tpl') as f:
    template = f.read()

for name in specialists:
    persona_path = f'.hall-cache/personas/{name}.md'
    with open(persona_path) as f:
        lines = [l.rstrip() for l in f if l.strip()]
    description = next((l.lstrip('# ') for l in lines if l.startswith('#')), name)

    content = template \
        .replace('{{SPECIALIST_NAME}}', name) \
        .replace('{{SPECIALIST_DESCRIPTION}}', description) \
        .replace('{{PERSONA_PATH}}', persona_path) \
        .replace('{{CACHE_ROOT}}', '.hall-cache')

    with open(f'.hall-cache/session/claude-agents/{name}.md', 'w') as f:
        f.write(content)
    print(f'  Generated: {name}')
PYEOF
```

### Step 6: Stack assembly

```bash
ASSEMBLED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"

python3 << PYEOF
import os

assembled_at = '${ASSEMBLED_AT}'
plugin_root  = '${PLUGIN_ROOT}'

with open(f'{plugin_root}/templates/CLAUDE-stack.md.tpl') as f:
    content = f.read()

content = content \
    .replace('{{PLUGIN_ROOT}}', plugin_root) \
    .replace('{{CACHE_ROOT}}', '.hall-cache') \
    .replace('{{ASSEMBLED_AT}}', assembled_at)

os.makedirs('.hall-cache/session', exist_ok=True)
with open('.hall-cache/session/CLAUDE-stack.md', 'w') as f:
    f.write(content)
print('Session stack assembled.')
PYEOF
```

### Step 7: CLAUDE.md injection

Check workspace root for an existing `CLAUDE.md`:

```bash
IMPORT_LINE="@.hall-cache/session/CLAUDE-stack.md"
if [ ! -f CLAUDE.md ]; then
  echo "$IMPORT_LINE" > CLAUDE.md
  echo "Created CLAUDE.md with session stack import."
elif grep -qF "$IMPORT_LINE" CLAUDE.md; then
  echo "CLAUDE.md already has session stack import — no-op."
else
  echo "WARNING: A CLAUDE.md already exists without the Hall stack import."
  echo "To activate Old Major on next session start, append this line to your CLAUDE.md:"
  echo "  $IMPORT_LINE"
  echo "Or run: echo '$IMPORT_LINE' >> CLAUDE.md"
fi
```

### Step 8: Start watcher daemon

Start the background watcher in the project directory:

```bash
nohup bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/watcher.sh" \
  &> .hall-cache/watcher.log &
echo "Watcher started (background polling for GitHub state changes)."
```

### Step 8.5: Schedule autonomous reconcile cron

```bash
ACTIVE_PLAN=false
for plan_dir in .hall-cache/plans/*/; do
  plan_file="$plan_dir/plan.md"
  [ -f "$plan_file" ] || continue
  plan_status=$(grep -m1 "Status:" "$plan_file" 2>/dev/null || echo "")
  echo "$plan_status" | grep -q "DONE" || { ACTIVE_PLAN=true; break; }
done
```

If `$ACTIVE_PLAN` is `true` (any `plan.md` not marked `Status: DONE`):

Call `CronCreate` with:
- **Schedule:** `*/5 * * * *`
- **Prompt:** `"Autonomous plan advancement (cron): drain .hall-cache/watcher-events.jsonl then run /hall:reconcile to update plan state. If any tasks are newly unlocked, dispatch them without waiting for confirmation — this is an unattended autonomous run. If REVIEWING tasks have needs_review set, trigger review dispatch. Append a one-line summary of what changed to .hall-cache/cron-log.md."`

Store the returned cron ID to `.hall-cache/session/cron.json`:
```json
{"cron_id": "<returned-id>", "created_at": "<ISO timestamp>"}
```

If no active plan exists, skip and note: `No active plan — autonomous cron not scheduled.`

### Step 9: Context injection (in-session activation)

Read and apply the assembled stack directly so Old Major activates now, without a restart:

Read `.hall-cache/session/CLAUDE-stack.md` and all files it @-imports, in order. Apply them as your operating instructions for this session. The `roster-index.md` @-import lists available specialists by name and domain. Full specialist personas live in `.hall-cache/personas/<name>.md` — load them at Tier 2 spawn time via `.hall-cache/session/claude-agents/<name>.md`, not at session open.

### Step 9.5: Automation config

Check whether an automation preference is already stored for this session:

```bash
python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('automation_level','missing'))" \
  < .hall-cache/session/config.json 2>/dev/null || echo "missing"
```

If the output is `0`, `1`, or `2`, skip this step — do not ask again.

If the output is `missing`, ask the invoker these two questions in sequence. Use the `AskUserQuestion` tool if available in session context; otherwise ask as plain text and wait for a response before continuing.

**Question 1:** "Auto-review? Should Old Major automatically dispatch a review after each specialist PR?"

**Question 2 (only if Question 1 is Yes):** "Auto-merge? If the review verdict is LGTM, should Old Major merge without invoker action?"

Map answers to automation level:

| Auto-review | Auto-merge | Level | Name |
|---|---|---|---|
| No | — | 0 | manual |
| Yes | No | 1 | review |
| Yes | Yes | 2 | full |

Write the config:

```bash
python3 -c "import json; open('.hall-cache/session/config.json','w').write(json.dumps({'automation_level': <LEVEL>, 'auto_review': <bool>, 'auto_merge': <bool>}, indent=2))"
```

Replace `<LEVEL>` with the integer and `<bool>` with `true`/`false` based on the invoker's answers.

Confirm to the invoker: `"Automation level set to <N> (<name>). Stored in .hall-cache/session/config.json."`

### Step 10: Check for existing plans

```bash
ls .hall-cache/plans/ 2>/dev/null || true
```

If plans exist, list them and ask whether to resume an existing plan or start fresh.

### Step 11: Show banner

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/hall-banner.sh"
```

Then ask what the invoker wants to build — one sentence, in character as Old Major.
