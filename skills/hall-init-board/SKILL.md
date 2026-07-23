---
name: hall-init-board
description: Provision the Hall of Automata Projects v2 board, custom fields, and labels on the current target repo — idempotent
argument-hint: [--force]
allowed-tools: [Bash]
---

# /hall:init-board

Provisions the GitHub Projects v2 board for Hall cross-invoker coordination. Safe to re-run — skips anything that already exists. Pass `--force` to bypass the cached board number and re-run creation.

State flows through `~/.hall/session/.board-init-state.json`. Hard-stop on any unhandled error.

## Code quality

All files produced by this skill must stay under 200 lines. Prefer many small, focused files. No duplicated logic.

## Execution sequence

### Step 1: Resolve repo and owner type

```bash
set -euo pipefail
REPO=$(git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')
OWNER=$(echo "$REPO" | cut -d/ -f1)
OWNER_TYPE=$(gh api "repos/${REPO}" --jq '.owner.type')
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
mkdir -p ~/.hall/session ~/.hall/$SLUG
python3 -c "
import json, os
json.dump({'owner':'${OWNER}','owner_type':'${OWNER_TYPE}','repo':'${REPO}'},
  open(os.path.expanduser('~/.hall/session/.board-init-state.json'),'w'), indent=2)
"
echo "Resolved: OWNER=${OWNER} OWNER_TYPE=${OWNER_TYPE}"
```

### Step 2: Check for existing board

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
BOARD_NUM=$(python3 -c \
  "import json, os; print(json.load(open(os.path.expanduser('~/.hall/$SLUG/config.json'))).get('board_project_number',''))" \
  2>/dev/null || echo "")
if [ -n "$BOARD_NUM" ]; then
  echo "Board #${BOARD_NUM} already provisioned — skipping Step 3."
  python3 -c "
import json, os
s = json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))
s['board_was_created'] = False
json.dump(s, open(os.path.expanduser('~/.hall/session/.board-init-state.json'),'w'), indent=2)
"
else
  echo "No board cached — will create."
fi
```

If `BOARD_NUM` is non-empty and `--force` was not passed, skip Step 3 and continue to Step 3.5.

### Step 3: Create Projects v2 board

Skip if `BOARD_NUM` is set (from Step 2) and `--force` was not passed.

```bash
set -euo pipefail
OWNER=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['owner'])")
OWNER_TYPE=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['owner_type'])")
REPO=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['repo'])")
REPO_NAME=$(echo "$REPO" | cut -d/ -f2)

if [ "$OWNER_TYPE" = "Organization" ]; then
  OWNER_ID=$(gh api graphql -f query='query($l:String!){organization(login:$l){id}}' \
    -F l="$OWNER" --jq '.data.organization.id')
else
  OWNER_ID=$(gh api graphql -f query='query($l:String!){user(login:$l){id}}' \
    -F l="$OWNER" --jq '.data.user.id')
fi

RESULT=$(gh api graphql \
  -f query='mutation($o:ID!,$t:String!){createProjectV2(input:{ownerId:$o,title:$t}){projectV2{id number}}}' \
  -F o="$OWNER_ID" -F t="$REPO_NAME")
PROJECT_ID=$(echo "$RESULT" | jq -r '.data.createProjectV2.projectV2.id')
PROJECT_NUM=$(echo "$RESULT" | jq -r '.data.createProjectV2.projectV2.number')
if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
  echo "ERROR: createProjectV2 returned null — check permissions (needs project:write on org)"
  echo "$RESULT" | jq -r '.errors[]?.message' 2>/dev/null || true
  exit 1
fi

REPO_ID=$(gh api graphql \
  -f query='query($o:String!,$r:String!){repository(owner:$o,name:$r){id}}' \
  -F o="$OWNER" -F r="$REPO_NAME" --jq '.data.repository.id')
gh api graphql \
  -f query='mutation($p:ID!,$r:ID!){linkProjectV2ToRepository(input:{projectId:$p,repositoryId:$r}){repository{name}}}' \
  -F p="$PROJECT_ID" -F r="$REPO_ID" --jq '.data.linkProjectV2ToRepository.repository.name'
echo "Board linked to repository ${REPO}."

python3 -c "
import json, os
s = json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))
s['project_id'] = '${PROJECT_ID}'
s['project_num'] = int('${PROJECT_NUM}')
s['board_was_created'] = True
json.dump(s, open(os.path.expanduser('~/.hall/session/.board-init-state.json'),'w'), indent=2)
"
echo "Created ${REPO_NAME} board #${PROJECT_NUM} (${PROJECT_ID})"
```

### Step 3.5: Scope default view to invoking repository

`updateProjectV2View` does not accept `filter` as an input — view filtering is not API-settable. Log the required filter for the manual step in Step 7.

```bash
set -euo pipefail
OWNER=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['owner'])")
REPO=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['repo'])")
REPO_NAME=$(echo "$REPO" | cut -d/ -f2)
echo "view-filter: repo:${OWNER}/${REPO_NAME}"
```

### Step 4: Create custom fields

Read `project_id` from state or `config.json`, then source the lib script.

```bash
set -euo pipefail
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:?CLAUDE_PLUGIN_ROOT must be set}"

export PROJECT_ID=$(python3 -c "
import json, os
s = json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))
cfg_path = os.path.expanduser('~/.hall/$SLUG/config.json')
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
print(s.get('project_id') or cfg.get('board_project_id',''))
")

# shellcheck source=skills/hall-init-board/lib/create-fields.sh
source "${PLUGIN_ROOT}/skills/hall-init-board/lib/create-fields.sh"
create_fields
```

### Step 5: Create labels

```bash
export REPO=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['repo'])")
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:?CLAUDE_PLUGIN_ROOT must be set}"

# shellcheck source=skills/hall-init-board/lib/create-labels.sh
source "${PLUGIN_ROOT}/skills/hall-init-board/lib/create-labels.sh"
create_labels
```

### Step 5.5: Push issue templates

```bash
REPO=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['repo'])")
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:?}"

echo "Pushing issue templates..."
for tpl in okr kr item; do
  path=".github/ISSUE_TEMPLATE/${tpl}.yml"
  if gh api "repos/${REPO}/contents/${path}" > /dev/null 2>&1; then
    echo "  skip: ${path} (exists)"
    continue
  fi
  content=$(base64 -w0 < "${PLUGIN_ROOT}/templates/issue-templates/${tpl}.yml")
  gh api "repos/${REPO}/contents/${path}" \
    -X PUT \
    -f message="chore: add ${tpl} issue template [hall-init-board]" \
    -f content="$content" > /dev/null \
    && echo "  created: ${path}" \
    || echo "  WARN: failed to push ${path} — continuing"
done
```

### Step 6: Run GetProjectMeta and persist

```bash
set -euo pipefail
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
OWNER=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['owner'])")
OWNER_TYPE=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))['owner_type'])")
PROJECT_NUM=$(python3 -c "
import json, os
s = json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))
cfg_path = os.path.expanduser('~/.hall/$SLUG/config.json')
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
print(s.get('project_num') or cfg.get('board_project_number',''))
")

FIELDS_FRAG='fields(first:50){nodes{...on ProjectV2Field{id name}...on ProjectV2SingleSelectField{id name options{id name}}}}'
if [ "$OWNER_TYPE" = "Organization" ]; then
  gh api graphql \
    -f query="query(\$o:String!,\$n:Int!){organization(login:\$o){projectV2(number:\$n){id number ${FIELDS_FRAG}}}}" \
    -F o="$OWNER" -F n="$PROJECT_NUM" --jq '.data.organization.projectV2' \
    > ~/.hall/session/.meta-raw.json
else
  gh api graphql \
    -f query="query(\$o:String!,\$n:Int!){user(login:\$o){projectV2(number:\$n){id number ${FIELDS_FRAG}}}}" \
    -F o="$OWNER" -F n="$PROJECT_NUM" --jq '.data.user.projectV2' \
    > ~/.hall/session/.meta-raw.json
fi

python3 << 'PYEOF'
import json, os

slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip()
meta = json.load(open(os.path.expanduser('~/.hall/session/.meta-raw.json')))
if not meta or 'id' not in meta:
    raise SystemExit('ERROR: GetProjectMeta returned empty — check project number and owner type')

fields_out = {}
for node in meta.get('fields', {}).get('nodes', []):
    if not node or 'id' not in node:
        continue
    entry = {'id': node['id']}
    if 'options' in node:
        entry['options'] = {o['name']: o['id'] for o in node['options']}
    fields_out[node['name']] = entry

json.dump({'project_id': meta['id'], 'fields': fields_out},
          open(os.path.expanduser(f'~/.hall/{slug}/board-meta.json'), 'w'), indent=2)

cfg_path = os.path.expanduser(f'~/.hall/{slug}/config.json')
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
cfg['board_project_number'] = str(meta.get('number', ''))
cfg['board_project_id'] = meta['id']
json.dump(cfg, open(cfg_path, 'w'), indent=2)
print(f"Resolved {len(fields_out)} fields. Persisted board-meta.json and config.json.")
PYEOF
```

### Step 6.5: Provision Roadmap view

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
PROJECT_ID=$(python3 -c "import json, os; print(json.load(open(os.path.expanduser('~/.hall/$SLUG/board-meta.json')))['project_id'])")
EXISTS=$(gh api graphql -f query="query{node(id:\"${PROJECT_ID}\"){...on ProjectV2{views(first:20){nodes{name}}}}}" --jq '[.data.node.views.nodes[].name]|index("Roadmap")' 2>/dev/null || echo "null")
if [ "$EXISTS" != "null" ]; then
  echo "skip: Roadmap view already exists"
else
  gh api graphql -f query="mutation{createProjectV2View(input:{projectId:\"${PROJECT_ID}\",name:\"Roadmap\",layout:ROADMAP_LAYOUT}){projectV2View{name}}}" \
    --jq '.data.createProjectV2View.projectV2View.name' 2>/dev/null \
    && echo "created: Roadmap view" || echo "WARN: Roadmap layout unavailable — continuing"
fi
```

### Step 7: Confirm

```bash
python3 << 'PYEOF'
import json, os
slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip()
meta = json.load(open(os.path.expanduser(f'~/.hall/{slug}/board-meta.json')))
cfg = json.load(open(os.path.expanduser(f'~/.hall/{slug}/config.json')))
state = json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json')))
board_num = cfg.get('board_project_number', '?')
owner = state['owner']
repo = state['repo']
url_seg = 'orgs' if state.get('owner_type', 'Organization') == 'Organization' else 'users'
print(f"Hall Board #{board_num} ready — {len(meta.get('fields', {}))} fields resolved, labels provisioned.")
print(f"\n⚠️  Manual steps required:")
if state.get('board_was_created', False):
    print(f"   1. Default repository → set to {repo}")
    print(f"      https://github.com/{url_seg}/{owner}/projects/{board_num}/settings")
    print(f"   2. Default view filter → set to: repo:{owner}/{repo}")
    print(f"      https://github.com/{url_seg}/{owner}/projects/{board_num}/views/1")
else:
    print(f"   1. Default view filter → set to: repo:{owner}/{repo}")
    print(f"      https://github.com/{url_seg}/{owner}/projects/{board_num}/views/1")
PYEOF
```
