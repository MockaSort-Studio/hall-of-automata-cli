---
name: hall-reconcile
description: Resync local plan state from GitHub issue/PR states
allowed-tools: [Bash, Read, Write, CronDelete]
---

# /hall:reconcile

Resync the local plan with GitHub's current state. Runs automatically before any dispatch; can be invoked manually.

## Execution

### Step 0: Drain watcher events

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
```

If `~/.hall/projects/$SLUG/watcher-events.jsonl` exists and is non-empty:
- Read all lines; parse each JSON object.
- Group by issue number and surface as a summary: `"Watcher detected N events since last reconcile: [list]"`
- Truncate the file to zero bytes: `> ~/.hall/projects/$SLUG/watcher-events.jsonl`
- Use these events as early-warning signals — the reconcile pass below queries GitHub authoritatively.

If absent or empty, skip silently.

Find the active plan. For each task with a `github_issue` number:

```bash
PLAN_DIR=$(ls -d ~/.hall/projects/$SLUG/plans/*/ | sort | tail -1)
```
Read `repo` from `$PLAN_DIR/plan.json` for the `--repo` argument throughout: `REPO=$(python3 -c "import json; print(json.load(open('$PLAN_DIR/plan.json'))['repo'])")` — split into ORG and REPO parts as needed.

```bash
BOARD_ACTIVE=$(python3 -c "import json, os; slug='$SLUG'; print(bool(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/config.json'))).get('board_project_number','')))"\ 2>/dev/null || echo "False")
```

For each issue, call `issue_read` (method: `get`, owner: ORG, repo: REPO, issue_number: N).
On `rate_limit` error, fall back to:
```bash
gh api repos/{ORG}/{REPO}/issues/{N} --jq '{state:.state,labels:[.labels[].name]}'
```

For any issue with `state = closed`, additionally check for a linked PR:

Call `search_pull_requests` (query: `repo:{ORG}/{REPO} closes #{N}`).
On `rate_limit` error, fall back to:
```bash
gh pr list --repo {ORG}/{REPO} --search "closes #{N}" --json state,mergedAt
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

**Open PR detection:** For each task with status DISPATCHED or IN_PROGRESS that has a `github_issue` and does NOT already have `needs_review: true`:

```bash
PR_INFO=$(gh pr list --repo {ORG}/{REPO} --search "closes #{N} is:open" --json number,headSha --jq '.[0]')
```

If the result is non-empty and non-null: set `github_pr` to the PR number (if not already set or changed); set `needs_review: true` and `review_cycle: 1` on the task entry.

**Fix-commit detection:** For each task with `github_pr` set, `review_cycle >= 1`, and `needs_review: false`:

```bash
HEAD_SHA=$(gh pr view {github_pr} --repo {ORG}/{REPO} --json headRefOid --jq '.headRefOid')
```

If `HEAD_SHA` differs from `task["last_reviewed_sha"]` (and `last_reviewed_sha` is non-empty): set `needs_review: true`.

**Newly REVIEWING:** Determine which tasks newly transitioned into REVIEWING — status was not REVIEWING on the prior reconcile pass, is now REVIEWING. For each such task:

1. Read `automation_level` from `~/.hall/session/config.json`. If the file is absent, treat as 0.
2. If `automation_level >= 1`, set `needs_review: true` on that task in `plan.json`.
3. If `automation_level` is 0 or the file is absent, do not write `needs_review` (or write `false`).

Reconcile must not clear `needs_review` — only dispatch clears it after filing the review issue.

```bash
AUTOMATION_LEVEL=$(python3 -c "
import json, sys, os
slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip() if os.path.exists(os.path.expanduser('~/.hall/session/.repo-slug')) else ''
try:
    cfg = json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/config.json')))
    print(cfg.get('automation_level', 0))
except FileNotFoundError:
    print(0)
")
```

Write the updated `plan.json`.

After writing `plan.json`, check if all tasks across all plans have reached a terminal state:

```bash
ALL_DONE=$(HALL_SLUG="$SLUG" python3 -c "
import json, glob, os
slug = os.environ.get('HALL_SLUG', '')
all_tasks = [t for f in glob.glob(os.path.expanduser('~/.hall/projects/' + slug + '/plans/*/plan.json')) for t in json.load(open(f)).get('tasks', [])]
terminal = {'MERGED', 'DONE', 'FAILED', 'ESCALATED'}
print('true' if all_tasks and all(t['status'] in terminal for t in all_tasks) else 'false')
")
```

If `ALL_DONE=true` and `~/.hall/projects/$SLUG/cron.json` exists:

```bash
CRON_ID=$(python3 -c "import json, os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/cron.json')))['cron_id'])" 2>/dev/null || echo "")
```

If `CRON_ID` is non-empty: call `CronDelete` with id=`$CRON_ID`. Then:

```bash
rm -f ~/.hall/projects/$SLUG/cron.json
echo "All tasks terminal — autonomous cron cancelled."
```

If GitHub wins on any conflict (task shows MERGED on GitHub but DISPATCHED locally), report the discrepancy and apply the GitHub state.

## Board writes

If `BOARD_ACTIVE=False`, skip this section entirely.

Fetch invoker login once before the loop:

```bash
INVOKER_LOGIN=$(gh api /user --jq '.login')
```

For each task whose status **newly** transitioned to MERGED or DONE during this pass:

1. Find item in `~/.hall/projects/$SLUG/board.json` where `issue_number` matches `task["github_issue"]`; if absent, log `Board item not found for issue #N` and skip.

2. Resolve the "Done" option ID from `~/.hall/projects/$SLUG/board-meta.json["fields"]["Status"]["options"]` (entry with name `"Done"`).

3. Call `update_item_field`:
   - `project_id` = `board.json["project_id"]`
   - `item_id` = matched item `id`
   - `field_id` = `board-meta.json["fields"]["Status"]["id"]`
   - `value` = `{"singleSelectOptionId": <Done option ID>}`
   - `invoker_login` = `$INVOKER_LOGIN`

   On `rate_limit`/`secondary-rate-limit` error:
   ```bash
   gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "<project_id>", itemId: "<item_id>", fieldId: "<field_id>", value: { singleSelectOptionId: "<option_id>" } }) { projectV2Item { id } } }'
   ```

4. Log `Board item #<N> → Done` on success; log error and continue — never abort reconcile.

Only process tasks present in `plan.json`; skip board-only items (OKR/KR).

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
