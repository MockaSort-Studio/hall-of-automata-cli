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

### Step 3: Persona fetch

Check cache freshness:
```bash
FETCHED_AT=$(cat .hall-cache/personas/.fetched_at 2>/dev/null || echo "")
NOW=$(date +%s)
```

If `--refresh` was passed OR `$FETCHED_AT` is empty OR it's >86400 seconds old, fetch:

```bash
mkdir -p .hall-cache/personas

# Fetch automaton_base.md
gh api repos/MockaSort-Studio/hall-of-automata/contents/agents/automaton_base.md \
  --jq '.content' | base64 -d > .hall-cache/personas/automaton_base.md

# Fetch old-major.md
gh api repos/MockaSort-Studio/hall-of-automata/contents/roster/old-major.md \
  --jq '.content' | base64 -d > .hall-cache/personas/old-major.md

# Discover advisory specialists dynamically from the roster directory.
# Saves the list to .advisory-roster.json for use in later steps.
gh api repos/MockaSort-Studio/hall-of-automata/contents/roster \
  --jq '[.[] | select(.type=="file" and (.name | endswith(".md")) and .name != "old-major.md") | .name[:-3]]' \
  > .hall-cache/personas/.advisory-roster.json

# Fetch each discovered advisory specialist persona
python3 -c "import json; [print(s) for s in json.load(open('.hall-cache/personas/.advisory-roster.json'))]" \
| while read -r SPECIALIST; do
  gh api "repos/MockaSort-Studio/hall-of-automata/contents/roster/${SPECIALIST}.md" \
    --jq '.content' | base64 -d > ".hall-cache/personas/${SPECIALIST}.md"
  echo "  Fetched: ${SPECIALIST}"
done

date -u +"%Y-%m-%dT%H:%M:%SZ" > .hall-cache/personas/.fetched_at
echo "Personas fetched and cached."
```

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
plugin_root = os.environ.get('CLAUDE_PLUGIN_ROOT', '.')

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

Fills all template variables including `{{ADVISORY_PERSONA_IMPORTS}}`, which expands to one `@`-import line per fetched advisory specialist.

```bash
ASSEMBLED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"

python3 << PYEOF
import json, os

assembled_at = '${ASSEMBLED_AT}'
plugin_root  = '${PLUGIN_ROOT}'

with open(f'{plugin_root}/templates/CLAUDE-stack.md.tpl') as f:
    content = f.read()

specialists = json.load(open('.hall-cache/personas/.advisory-roster.json'))
advisory_imports = '\n\n'.join(f'@.hall-cache/personas/{s}.md' for s in specialists)

content = content \
    .replace('{{PLUGIN_ROOT}}', plugin_root) \
    .replace('{{CACHE_ROOT}}', '.hall-cache') \
    .replace('{{ASSEMBLED_AT}}', assembled_at) \
    .replace('{{ADVISORY_PERSONA_IMPORTS}}', advisory_imports)

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

### Step 9: Context injection (in-session activation)

Read and apply the assembled stack directly so Old Major activates now, without a restart:

Read `.hall-cache/session/CLAUDE-stack.md` and all files it @-imports, in order. Apply them as your operating instructions for this session. The @-imports include all fetched advisory specialist personas — the exact set is determined by what was discovered from the Hall roster in Step 3.

### Step 10: Check for existing plans

```bash
ls .hall-cache/plans/ 2>/dev/null || true
```

If plans exist, list them and ask whether to resume an existing plan or start fresh.

### Step 11: Show banner

Old Major introduces himself and asks what the user wants to build.
