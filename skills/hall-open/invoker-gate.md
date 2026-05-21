---
name: hall-open-invoker-gate
description: Invoker detection procedure — executed from hall-open Step 6
---

# Invoker Detection Gate

Use `AskUserQuestion` with one question:
- **Header:** `"Hall invoker?"`
- **Question:** `"Are you a Hall invoker? An invoker is a member of the automata-invokers team on GitHub — you have dispatch access and can send tasks to Hall specialists. Non-invokers get local orchestration mode: Old Major plans and implements inline. See: https://mockasort-studio.github.io/hall-codex/how-to-invoke/"`
- **Options:** `"Yes, I'm an invoker"` / `"No, use local mode"`

**If "No":** write `.hall-cache/invoker.json` as `{"mode":"local","verified_at":"<ISO>","checks":{}}`. Set `local_mode: true` and `automation_level: 0` in `config.json`. Skip automation Q&A.

**If "Yes":** run verification:

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
- `HALL_REPO=false` → print "Hall not found in org ${ORG} — verify the Hall is set up at github.com/apps/hall-of-automata"; write `mode: local`; set `local_mode: true`, `automation_level: 0`
- `HALL_REPO=true` + `TEAM_MEMBER=false` → print "Hall found but you are not in automata-invokers — switching to local mode"; write `mode: local`; set `local_mode: true`, `automation_level: 0`
- `HALL_REPO=true` + `TEAM_MEMBER=unknown` → print "WARN: team membership unverifiable (token lacks read:org) — proceeding as invoker"; write `mode: invoker`; set `local_mode: false`
- `HALL_REPO=true` + `TEAM_MEMBER=true` → write `mode: invoker`; set `local_mode: false`

`invoker.json` schema:
```json
{
  "mode": "invoker | local",
  "verified_at": "<ISO timestamp>",
  "checks": {"hall_repo": true, "team_member": true}
}
```

Only write `.hall-cache/invoker.json` after the final decision — do not cache a partial result.

**Automation Q&A (invoker path only):** if `local_mode: false` was just set and `AUTO_LEVEL=missing`, use `AskUserQuestion`: Q1 — auto-review after each specialist PR? Q2 (if Q1=Yes) — auto-merge on LGTM? Map to level 0 (manual), 1 (review), 2 (full). Write `local_mode` and `automation_level` to `.hall-cache/session/config.json`.
