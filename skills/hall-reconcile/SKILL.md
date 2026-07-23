---
name: hall-reconcile
description: Resync local plan state from GitHub issue/PR states
allowed-tools: [Bash, Read, Write, CronDelete]
---

# /hall:reconcile

Resync the local plan with GitHub's current state. Runs automatically before any dispatch; can be invoked manually.

## Execution

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
```

Find the active plan. For each task with a `github_issue` number:

```bash
PLAN_DIR=$(ls -d ~/.hall/$SLUG/plans/*/ | sort | tail -1)
```
Read `repo` from `$PLAN_DIR/plan.json` for the `--repo` argument throughout: `REPO=$(python3 -c "import json; print(json.load(open('$PLAN_DIR/plan.json'))['repo'])")` — split into ORG and REPO parts as needed.

```bash
BOARD_ACTIVE=$(python3 -c "import json, os; slug='$SLUG'; print(bool(json.load(open(os.path.expanduser(f'~/.hall/{slug}/config.json'))).get('board_project_number','')))"\ 2>/dev/null || echo "False")
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

1. Read `automation_level` from `~/.hall/<slug>/config.json` (slug from `~/.hall/session/.repo-slug`). If the file is absent, treat as 0.
2. If `automation_level >= 1`, set `needs_review: true` on that task in `plan.json`.
3. If `automation_level` is 0 or the file is absent, do not write `needs_review` (or write `false`).

Reconcile must not clear `needs_review` — only dispatch clears it after filing the review issue.

```bash
AUTOMATION_LEVEL=$(python3 -c "
import json, sys, os
slug = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip() if os.path.exists(os.path.expanduser('~/.hall/session/.repo-slug')) else ''
try:
    cfg = json.load(open(os.path.expanduser(f'~/.hall/{slug}/config.json')))
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
all_tasks = [t for f in glob.glob(os.path.expanduser('~/.hall/' + slug + '/plans/*/plan.json')) for t in json.load(open(f)).get('tasks', [])]
terminal = {'MERGED', 'DONE', 'FAILED', 'ESCALATED'}
print('true' if all_tasks and all(t['status'] in terminal for t in all_tasks) else 'false')
")
```

If `ALL_DONE=true` and `~/.hall/$SLUG/cron.json` exists:

```bash
CRON_ID=$(python3 -c "import json, os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/{slug}/cron.json')))['cron_id'])" 2>/dev/null || echo "")
```

If `CRON_ID` is non-empty: call `CronDelete` with id=`$CRON_ID`. Then:

```bash
rm -f ~/.hall/$SLUG/cron.json
echo "All tasks terminal — autonomous cron cancelled."
```

If GitHub wins on any conflict (task shows MERGED on GitHub but DISPATCHED locally), report the discrepancy and apply the GitHub state.

## Board writes

Read `skills/hall-dispatch/board-write.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the **reconcile-write** procedure for each task that newly transitioned to MERGED or DONE during this pass.

## Saga close

After board writes complete, check if all tasks across the active plan reached a successful terminal state:

```bash
ALL_SAGA_DONE=$(HALL_SLUG="$SLUG" python3 -c "
import json, glob, os
slug = os.environ.get('HALL_SLUG', '')
all_tasks = [t for f in glob.glob(os.path.expanduser('~/.hall/' + slug + '/plans/*/plan.json')) for t in json.load(open(f)).get('tasks', [])]
success = {'MERGED', 'DONE'}
print('true' if all_tasks and all(t['status'] in success for t in all_tasks) else 'false')
")
```

FAILED or ESCALATED tasks prevent close — those require manual resolution. If `ALL_SAGA_DONE=true`:

```bash
TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "WARN: GITHUB_PERSONAL_ACCESS_TOKEN not set — skip saga close"
else
  WIKI_DIR=$(mktemp -d)
  if git clone "https://x-access-token:${TOKEN}@github.com/${REPO}.wiki.git" "$WIKI_DIR" 2>/dev/null; then
    OPEN_FILE=$(find "$WIKI_DIR" -maxdepth 1 -name "*\[open\]*" | head -1)
    if [ -n "$OPEN_FILE" ]; then
      CLOSED_FILE="${OPEN_FILE/\[open\]/\[complete\]}"
      git -C "$WIKI_DIR" mv "$OPEN_FILE" "$CLOSED_FILE"
      git -C "$WIKI_DIR" -c user.name="Old Major" -c user.email="old-major@hall" \
        commit -m "wiki: close saga — all OKRs merged"
      git -C "$WIKI_DIR" push origin master
      echo "Saga closed: $(basename "$CLOSED_FILE")"
    fi
  else
    echo "WARN: wiki clone failed — skip saga close"
  fi
  rm -rf "$WIKI_DIR"
fi
```

`REPO` is `org/repo` from `plan.json` (same value used throughout reconcile). Skip silently if no `[open]` wiki page exists — state is already correct or will be resolved manually.

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
