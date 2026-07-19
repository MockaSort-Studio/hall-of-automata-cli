---
name: hall-open-standalone
description: Org and repo resolution for standalone mode and empty-slug fallback — executed from hall-open Step 1 when STANDALONE=true or SLUG_STATUS=empty
---

# Standalone Mode — Org and Repo Resolution

Execute when `STANDALONE=true` OR `SLUG_STATUS=empty`. Resolves the target org and repo,
persists the org, and sets `ORG`, `REPO_NAME`, `REPO`, and `SLUG` for subsequent `hall-open` steps.

Hard-stop if org verification fails. Warn-and-continue on non-critical errors.

## Step A: Setup

```bash
mkdir -p "$HOME/.hall/session" "$HOME/.hall/context"
```

## Step B: Check for persisted org

```bash
HALL_CONFIG="$HOME/.hall/.config.json"
ORG=""
if [ -f "$HALL_CONFIG" ]; then
  ORG=$(python3 -c "
import json, sys
try:
    sys.stdout.write(json.load(open('$HOME/.hall/.config.json')).get('org', ''))
except Exception:
    pass
" 2>/dev/null || echo "")
fi
```

If `ORG` is non-empty: skip to [Step D: Repo picker](#step-d-repo-picker).

## Step C: Org selection via invoker team membership

```bash
ORGS_JSON=$(gh api user/teams --jq '[.[].organization.login] | unique' 2>/dev/null || echo "[]")
ORG_COUNT=$(python3 -c "import json, sys; sys.stdout.write(str(len(json.loads(sys.argv[1]))))" "$ORGS_JSON")
```

- **Zero orgs:** print `"ERROR: no GitHub orgs found via team membership — cannot proceed in standalone mode."` and halt.
- **One org:** `ORG=$(python3 -c "import json, sys; sys.stdout.write(json.loads(sys.argv[1])[0])" "$ORGS_JSON")`
- **Multiple orgs:** Use `AskUserQuestion`:
  - Header: `"Which org?"`
  - Question: `"Select the GitHub org where hall-of-automata is installed. (The app must already be set up in the chosen org.)"`
  - Options: up to 4 org logins from `$ORGS_JSON` — label = org login, description = `"GitHub org: <login>"`. The "Other" fallback accepts a custom value.
  - Assign the user's selection to `ORG`.

**Verify hall-of-automata is present:**

```bash
gh api "repos/$ORG/hall-of-automata" --silent 2>/dev/null
VERIFY_STATUS=$?
```

If `VERIFY_STATUS != 0`: print `"ERROR: hall-of-automata not found in org $ORG — confirm the Hall app is installed at github.com/organizations/$ORG/settings/installations"` and halt.

**Persist org to global config:**

```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.hall/.config.json')
d = json.load(open(path)) if os.path.exists(path) else {}
d['org'] = '$ORG'
json.dump(d, open(path, 'w'))
print('Org persisted: $ORG')
"
```

## Step D: Repo picker

```bash
REPOS_JSON=$(gh api "/orgs/$ORG/repos?per_page=100&sort=updated" \
  --jq '[.[].name]' 2>/dev/null || echo "[]")
REPO_COUNT=$(python3 -c "import json, sys; sys.stdout.write(str(len(json.loads(sys.argv[1]))))" "$REPOS_JSON")
```

- **Zero repos:** print `"ERROR: no repositories found in org $ORG."` and halt.
- **One repo:** `REPO_NAME=$(python3 -c "import json, sys; sys.stdout.write(json.loads(sys.argv[1])[0])" "$REPOS_JSON")` — no picker.
- **Multiple repos:** Use `AskUserQuestion`:
  - Header: `"Which repo?"`
  - Question: `"Select the target repository in $ORG."`
  - Options: up to 4 repo names from `$REPOS_JSON` (first 4, sorted by last updated) — label = repo name,
    description = `"Repo: $ORG/<name>"`. The "Other" fallback accepts a custom repo name.
  - Assign the user's selection to `REPO_NAME`.

**Write `target_repo` and export `REPO`:**

```bash
python3 -c "
import json, os
slug = '$REPO_NAME'
# persist to global config for future slug derivation
gcfg = os.path.expanduser('~/.hall/.config.json')
gd = json.load(open(gcfg)) if os.path.exists(gcfg) else {}
gd['target_repo'] = '$ORG/$REPO_NAME'
json.dump(gd, open(gcfg, 'w'))
# write to per-project config
proj = os.path.expanduser(f'~/.hall/projects/{slug}')
os.makedirs(proj, exist_ok=True)
pcfg = f'{proj}/config.json'
d = json.load(open(pcfg)) if os.path.exists(pcfg) else {}
d['target_repo'] = '$ORG/$REPO_NAME'
json.dump(d, open(pcfg, 'w'))
# write slug for other processes
open(os.path.expanduser('~/.hall/session/.repo-slug'), 'w').write(slug)
print('Target repo: $ORG/$REPO_NAME')
"
```

```bash
REPO="$ORG/$REPO_NAME"
SLUG="$REPO_NAME"
```

After this file completes, `ORG`, `REPO_NAME`, `REPO`, and `SLUG` are set for the remainder of `hall-open`.

// Snowball 🐷 — standalone-flow now covers the git-failure path too; no slug goes unresolved
