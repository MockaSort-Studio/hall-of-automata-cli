---
name: hall-open-invoker-gate
description: Invoker detection procedure — executed from hall-open Step 6
---

# Invoker Detection Gate

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
    assert d.get('mode') in ('invoker', 'local')
    print('Invoker already verified (mode=' + d['mode'] + ') — gate skipped.')
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
mode = inv.get('mode', '')
local_mode = inv.get('local_mode', mode == 'local')
slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip()
cfg_path = os.path.expanduser(f'~/.hall/projects/{slug}/config.json')
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
auto_level = cfg.get('automation_level', 'missing')
```

- If `local_mode is True` (or `mode == "local"`):
  - Set `cfg['automation_level'] = 0`; write back with `json.dump(cfg, open(cfg_path, 'w'), indent=2)`.
  - Print `"Invoker mode: local (cached). Skipping verification."`
  - **Exit gate** — skip all Q&A and verification below.
- If `local_mode is False` (or `mode == "invoker"`):
  - Print `"Invoker verified (cached). Checking automation level..."`
  - If `auto_level != 'missing'`: **exit gate** — skip automation Q&A.
  - Else: proceed to **Automation Q&A** below — skip the "Are you a Hall invoker?" question and all verification checks.

## Live detection (runs when no valid cache)

Use `AskUserQuestion` with one question:
- **Header:** `"Hall invoker?"`
- **Question:** `"Are you a Hall invoker? An invoker is a member of the automata-invokers team on GitHub — you have dispatch access and can send tasks to Hall specialists. Non-invokers get local orchestration mode: Old Major plans and implements inline. See: https://mockasort-studio.github.io/hall-codex/how-to-invoke/"`
- **Options:** `"Yes, I'm an invoker"` / `"No, use local mode"`

**If "No":** write `~/.hall/$ORG/invoker.json` as `{"mode":"local","local_mode":true,"verified_at":"<ISO>","checks":{}}`. Set `automation_level: 0` in `~/.hall/projects/<slug>/config.json` (read slug from `~/.hall/session/.repo-slug`). Skip automation Q&A.

**If "Yes":** run verification:

```bash
if [ "${STANDALONE:-false}" = "true" ]; then
  ORG=$(python3 -c "import json,os; print(json.load(open(os.path.expanduser('~/.hall/.config.json')))['org'])" 2>/dev/null || echo "")
else
  ORG=$(echo "$REPO" | cut -d/ -f1)
fi
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
- `HALL_REPO=false` → print "Hall not found in org ${ORG} — verify the Hall is set up at github.com/apps/hall-of-automata"; write `mode: local`, `local_mode: true`; set `automation_level: 0` in config
- `HALL_REPO=true` + `TEAM_MEMBER=false` → print "Hall found but you are not in automata-invokers — switching to local mode"; write `mode: local`, `local_mode: true`; set `automation_level: 0` in config
- `HALL_REPO=true` + `TEAM_MEMBER=unknown` → print "WARN: team membership unverifiable (token lacks read:org) — proceeding as invoker"; write `mode: invoker`, `local_mode: false`
- `HALL_REPO=true` + `TEAM_MEMBER=true` → write `mode: invoker`, `local_mode: false`

Create the org directory and write `~/.hall/$ORG/invoker.json` after the final decision — do not cache a partial result:

```bash
mkdir -p ~/.hall/$ORG
```

`invoker.json` schema:
```json
{
  "mode": "invoker | local",
  "local_mode": true | false,
  "verified_at": "<ISO timestamp>",
  "checks": {"hall_repo": true, "team_member": true}
}
```

**Automation Q&A (invoker path only):** if `local_mode: false` was just set and `AUTO_LEVEL=missing`, use `AskUserQuestion`: Q1 — auto-review after each specialist PR? Q2 (if Q1=Yes) — auto-merge on LGTM? Map to level 0 (manual), 1 (review), 2 (full). Write `automation_level` to `~/.hall/projects/<slug>/config.json` (read slug from `~/.hall/session/.repo-slug`).

For all decision paths, write `automation_level` to config using:
```python
import json, os
slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip()
cfg_path = os.path.expanduser(f'~/.hall/projects/{slug}/config.json')
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
cfg['automation_level'] = ...
json.dump(cfg, open(cfg_path, 'w'), indent=2)
```
