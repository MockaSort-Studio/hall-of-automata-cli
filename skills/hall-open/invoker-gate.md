---
name: hall-open-invoker-gate
description: Invoker verification — executed from hall-open Step 4
---

# Invoker Verification Gate

Dispatch requires membership in the `automata-invokers` team on the org that has the Hall installed. There is no fallback mode — if verification fails, `/hall:open` halts and does not proceed.

Run this bash guard first. If it exits 0, gate is complete — do not execute any further steps in this file:

```bash
python3 -c "
import json, os, sys
org = os.environ.get('ORG', '')
if not org:
    try: org = json.load(open(os.path.expanduser('~/.hall/.config.json'))).get('org', '')
    except Exception: pass
try:
    d = json.load(open(os.path.expanduser(f'~/.hall/{org}/invoker.json')))
    assert d.get('mode') == 'invoker'
    print('Invoker already verified — gate skipped.')
    sys.exit(0)
except Exception:
    sys.exit(1)
"
```

## Cached invoker check (runs first)

If `~/.hall/$ORG/invoker.json` exists AND `--verify` was not passed:

```python
import json, os
org = os.environ.get('ORG', '') or json.load(open(os.path.expanduser('~/.hall/.config.json'))).get('org', '')
inv = json.load(open(os.path.expanduser(f'~/.hall/{org}/invoker.json')))
slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip()
cfg_path = os.path.expanduser(f'~/.hall/{slug}/config.json')
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
auto_level = cfg.get('automation_level', 'missing')
```

Print `"Invoker verified (cached). Checking automation level..."`
If `auto_level != 'missing'`: **exit gate** — skip automation Q&A.
Else: proceed to **Automation Q&A** below — skip verification below.

## Live verification (runs when no valid cache)

```bash
ORG=$(echo "$REPO" | cut -d/ -f1)
```

Call `get_me` MCP → `ME` = returned `login` field.
`# On rate_limit/secondary-rate-limit error: ME=$(gh api /user --jq '.login')`

Call `search_repositories` MCP with query `repo:${ORG}/hall-of-automata`. `HALL_REPO=true` if results are non-empty; `false` otherwise.
`# On rate_limit/secondary-rate-limit error: gh api "repos/${ORG}/hall-of-automata" --silent && HALL_REPO=true || HALL_REPO=false`

Call `get_team_members` MCP with org=`$ORG`, team_slug=`automata-invokers`. Determine `TEAM_MEMBER`:
- Error response (403, not found, rate limit): `TEAM_MEMBER=unknown`
- `$ME` in returned members list: `TEAM_MEMBER=true`
- Otherwise: `TEAM_MEMBER=false`

`# On rate_limit/secondary-rate-limit error: TEAM_RAW=$(gh api "orgs/${ORG}/teams/automata-invokers/memberships/${ME}" --jq '.state'); case "$TEAM_RAW" in active|pending) TEAM_MEMBER=true ;; "") TEAM_MEMBER=unknown ;; *) TEAM_MEMBER=false ;; esac`

Decision:
- `HALL_REPO=false` → print `"Hall not found in org ${ORG} — this plugin requires the Hall installed and automata-invokers membership. Set up at github.com/apps/hall-of-automata, or ask your org admin."` **Halt** — do not write `invoker.json`; stop `/hall:open` here.
- `HALL_REPO=true` + `TEAM_MEMBER=false` → print `"Hall found in ${ORG}, but you are not a member of automata-invokers — request access from your org admin."` **Halt** — do not write `invoker.json`; stop `/hall:open` here.
- `HALL_REPO=true` + `TEAM_MEMBER=unknown` → print "WARN: team membership unverifiable (token lacks read:org) — proceeding as invoker"; write `mode: invoker`
- `HALL_REPO=true` + `TEAM_MEMBER=true` → write `mode: invoker`

Only the two passing outcomes reach this point. Create the org directory and write `~/.hall/$ORG/invoker.json` after the decision — do not cache a partial result:

```bash
mkdir -p ~/.hall/$ORG
```

`invoker.json` schema:
```json
{
  "mode": "invoker",
  "verified_at": "<ISO timestamp>",
  "checks": {"hall_repo": true, "team_member": true}
}
```

**Automation Q&A:** if `AUTO_LEVEL=missing`, use `AskUserQuestion`: Q1 — auto-review after each specialist PR? Q2 (if Q1=Yes) — auto-merge on LGTM? Map to level 0 (manual), 1 (review), 2 (full). Write `automation_level` to `~/.hall/<org>/<slug>/config.json` (read org/slug from `~/.hall/session/.repo-slug`).

```python
import json, os
slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip()
cfg_path = os.path.expanduser(f'~/.hall/{slug}/config.json')
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
cfg['automation_level'] = ...
json.dump(cfg, open(cfg_path, 'w'), indent=2)
```
