---
name: hall-open-repo-picker
description: Org and repo resolution fallback — executed from hall-open Step 1 when .repo-slug is absent or empty
---

# Org and Repo Resolution — Picker Fallback

Execute when `SLUG` is empty — no `~/.hall/.repo-slug`. Resolves the target org and repo,
persists the result, and sets `ORG`, `REPO_NAME`, `REPO`, and `SLUG` for subsequent `hall-open` steps.

Hard-stop if org verification fails. Warn-and-continue on non-critical errors.

## Step A: Org selection via invoker team membership

```bash
ORGS_JSON=$(gh api user/teams --jq '[.[].organization.login] | unique' 2>/dev/null || echo "[]")
ORG_COUNT=$(python3 -c "import json, sys; sys.stdout.write(str(len(json.loads(sys.argv[1]))))" "$ORGS_JSON")
```

- **Zero orgs:** print `"ERROR: no GitHub orgs found via team membership — cannot resolve org."` and halt.
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

## Step B: Repo picker

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

**Persist and export `REPO`:**

```bash
python3 -c "
import json, os
slug = '$REPO_NAME'
org = '$ORG'
org_slug = f'{org}/{slug}'
# ensure project directory exists
proj = os.path.expanduser(f'~/.hall/{org_slug}')
os.makedirs(proj, exist_ok=True)
# write org/slug for path resolution
open(os.path.expanduser('~/.hall/.repo-slug'), 'w').write(org_slug)
print('Target repo: $ORG/$REPO_NAME')
"
```

```bash
REPO="$ORG/$REPO_NAME"
SLUG="$REPO_NAME"
```

After this file completes, `ORG`, `REPO_NAME`, `REPO`, and `SLUG` are set for the remainder of `hall-open`.

// Snowball 🐷 — picker is the sole fallback; no slug goes unresolved without user input
