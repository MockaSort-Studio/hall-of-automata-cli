---
name: hall-reconcile
description: Resync local plan state from GitHub issue/PR states
allowed-tools: [Bash, Read, Write]
---

# /hall:reconcile

Resync the local plan with GitHub's current state. Runs automatically before any dispatch; can be invoked manually.

## Execution

Find the active plan. For each task with a `github_issue` number:

```bash
PLAN_DIR=$(ls -d .hall-cache/plans/*/ | sort | tail -1)
```
Read `repo` from `$PLAN_DIR/plan.json` for the `--repo` argument throughout: `REPO=$(python3 -c "import json; print(json.load(open('$PLAN_DIR/plan.json'))['repo'])")`.
```bash
# For each issue:
gh issue view <N> --repo <ORG/REPO> --json state,labels,comments,url
```

Update task status based on issue state and labels:

| GitHub state | Labels | → Plan status |
|---|---|---|
| open | `hall:in-progress` | IN_PROGRESS |
| open | `hall:awaiting-input` | AWAITING_INPUT |
| open | `hall:post-mortem` | FAILED |
| open | `hall:invoker-queued` | DISPATCHED (queued) |
| closed | linked PR merged | MERGED |
| closed | no linked PR | FAILED |

If a PR associated with a MERGED issue has its own `merged_at` value, record it in the task entry.

After updating all tasks, identify any newly-eligible tasks (tasks whose `depends_on` entries are all now MERGED) and update them from PLANNED to READY (deferred).

Write the updated `plan.json`.

If GitHub wins on any conflict (task shows MERGED on GitHub but DISPATCHED locally), report the discrepancy and apply the GitHub state.

End with a reconciliation summary: N tasks updated, M newly eligible.
