---
name: hall-reconcile
description: Resync local plan state from GitHub issue/PR states
allowed-tools: [Bash, Read, Write]
---

# /hall:reconcile

Resync the local plan with GitHub's current state. Runs automatically before any dispatch; can be invoked manually.

## Execution

### Step 0: Drain watcher events

If `.hall-cache/watcher-events.jsonl` exists and is non-empty:
- Read all lines; parse each JSON object.
- Group by issue number and surface as a summary: `"Watcher detected N events since last reconcile: [list]"`
- Truncate the file to zero bytes: `> .hall-cache/watcher-events.jsonl`
- Use these events as early-warning signals — the reconcile pass below queries GitHub authoritatively.

If absent or empty, skip silently.

Find the active plan. For each task with a `github_issue` number:

```bash
PLAN_DIR=$(ls -d .hall-cache/plans/*/ | sort | tail -1)
```
Read `repo` from `$PLAN_DIR/plan.json` for the `--repo` argument throughout: `REPO=$(python3 -c "import json; print(json.load(open('$PLAN_DIR/plan.json'))['repo'])")`.
```bash
# For each issue:
gh issue view <N> --repo <ORG/REPO> --json state,labels,comments,url
```

For any issue with `state = closed`, additionally check for a linked PR:

```bash
gh pr list --repo <REPO> --search "closes #<N>" --json state,mergedAt
```

Update task status using this table:

| GitHub state | Condition | → Plan status |
|---|---|---|
| open | `hall:in-progress` | IN_PROGRESS |
| open | `hall:awaiting-input` | AWAITING_INPUT |
| open | `hall:post-mortem` | FAILED |
| open | `hall:invoker-queued` | DISPATCHED (queued) |
| closed | linked PR exists and is open (not merged) | REVIEWING |
| closed | linked PR merged | MERGED |
| closed | no linked PR | FAILED |

A PR is open if `state = "open"`. A PR is merged if `mergedAt` is non-null (use this to distinguish REVIEWING from MERGED when a PR is closed).

If a PR associated with a MERGED issue has its own `merged_at` value, record it in the task entry.

After updating all tasks, identify any newly-eligible tasks (tasks whose `depends_on` entries are all now MERGED) and update them from PLANNED to READY (deferred).

## Setting `needs_review`

After updating task states, determine which tasks **newly** transitioned into REVIEWING — status was not REVIEWING on the prior reconcile pass, is now REVIEWING. For each such task:

1. Read `automation_level` from `.hall-cache/session/config.json`. If the file is absent, treat as 0.
2. If `automation_level >= 1`, set `needs_review: true` on that task in `plan.json`.
3. If `automation_level` is 0 or the file is absent, do not write `needs_review` (or write `false`).

Reconcile must not clear `needs_review` — only dispatch clears it after filing the review issue.

```bash
AUTOMATION_LEVEL=$(python3 -c "
import json, sys
try:
    cfg = json.load(open('.hall-cache/session/config.json'))
    print(cfg.get('automation_level', 0))
except FileNotFoundError:
    print(0)
")
```

Write the updated `plan.json`.

If GitHub wins on any conflict (task shows MERGED on GitHub but DISPATCHED locally), report the discrepancy and apply the GitHub state.

## Summary

End with a reconciliation summary:

```
N tasks updated, M newly eligible
```

If any tasks newly transitioned into REVIEWING, append on a new line:

```
K tasks newly REVIEWING — review dispatch pending
```

Omit the second line if K = 0.

## Full state reference

All states a task in `plan.json` may carry, in lifecycle order:

| Status | Meaning |
|---|---|
| PLANNED | Not yet ready; dependencies unresolved |
| READY | Dependencies met; awaiting dispatch |
| DISPATCHED | Issue filed and assigned |
| IN_PROGRESS | Agent actively working |
| AWAITING_INPUT | Agent blocked; invoker input needed |
| REVIEWING | Issue closed; linked PR open and not yet merged |
| MERGED | PR merged; task complete |
| FAILED | Issue closed with no PR, or `hall:post-mortem` label |
| ESCALATED | Review concluded non-LGTM; invoker action needed |

// Snowball 🐷 — the lifecycle is only as trustworthy as the state that tracks it
