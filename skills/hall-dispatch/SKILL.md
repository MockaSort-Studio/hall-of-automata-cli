---
name: hall-dispatch
description: Dispatch ready tasks to the Hall as GitHub Issues with quota stewardship
argument-hint: [--single <task_id>] [--dry-run]
allowed-tools: [Bash, Read, Write, CronCreate, mcp__github__*]
---

# /hall:dispatch

Dispatch ready tasks to the Hall. Old Major normally proposes this in conversation after showing the confirmation summary; use this command for explicit control.

- `--single <task_id>`: dispatch one specific task regardless of ready-set state
- `--dry-run`: preview the issues that would be created without filing them

## Execution

### Local mode branch

Read config before any GitHub API call:

```bash
LOCAL_MODE=$(python3 -c "
import json
try:
    print(json.load(open('.hall-cache/session/config.json')).get('local_mode', False))
except FileNotFoundError:
    print(False)
" 2>/dev/null || echo "False")
```

`LOCAL_MODE=True` → follow [LOCAL.md](LOCAL.md). Stop — do not continue to Step 0.
`LOCAL_MODE=False` or config absent → continue to Step 0.

### Step 0: Review dispatch

Run `/hall:review`. Wait for it to complete before continuing to Step 1.

### Step 1: Reconcile

Run the reconcile procedure from `/hall:reconcile` before proceeding.

### Step 2: Determine the ready set

Tasks with status READY (deferred) or PLANNED whose `depends_on` entries are all MERGED.

If `--single` is specified, use only that task (verify it's in a dispatchable state).

### Step 3: Check quota

```bash
Read `repo` from the active plan's `plan.json` (e.g. `python3 -c "import json; print(json.load(open(PLAN_DIR+'plan.json'))['repo'])"`) and substitute it for `<ORG/REPO>` throughout.
```
Call `mcp__github__list_issues` with `owner: <ORG>`, `repo: <REPO_NAME>`, `labels: ["hall:in-progress"]`. Count the returned items.  
`# On rate_limit/secondary-rate-limit error: gh issue list --repo <ORG/REPO> --label "hall:in-progress" --json number | jq length`

If the ready set exceeds estimated available capacity, display:
> "N tasks ready, estimated pool capacity is M. Recommend filing M now and holding N-M as deferred. Proceed with recommendation, or file all N?"

Default: the steward path (file up to capacity).

### Step 4: Confirmation summary

Display before any filing:

```
Ready to dispatch N tasks:

  Task 1 title → <specialist-A> (hall:<specialist-A>) [doing]
    Routing: <rationale>.
  Task 2 title → <specialist-B> (hall:<specialist-B>) [doing]
    Routing: <rationale>.

Dispatch order: Task 1 at T+0, Task 2 at T+15s (15s inter-dispatch jitter).
Estimated turn budget: ~40 turns per task.

Proceed? [y/N]
```

If `--dry-run`, show the confirmation summary and the issue bodies that would be created, then stop.

### Step 5: File issues

For each task in dispatch order, spaced 15 seconds apart:

Call `mcp__github__issue_write` with `owner: <ORG>`, `repo: <REPO_NAME>`, `method: create`, `title: "<task title>"`, `labels: ["hall:<specialist>"]`, `body: "<issue body>"`.  
`# On rate_limit/secondary-rate-limit error: gh issue create --repo <ORG/REPO> --title "<task title>" --label "hall:<specialist>" --body "<issue body>"`

Issue body format:
```
<!-- Hall dispatch by Old Major (Session Mode) -->

## Working repository

All work for this task — branch, commits, and the final PR — must be created in **`<ORG/REPO>`**. Do not create branches or PRs on any other repository.

## Summary

<one paragraph description of the task>

## Acceptance criteria

<what done looks like>

## Context

<relevant context the specialist needs — existing code references, design decisions, constraints>

## Routing

Assigned to <Specialist>. Rationale: <routing_rationale text>

## Dependencies

<list of parent tasks that have completed, with their PR links>

## Code quality

Applies to all files produced by this task, regardless of language or framework:

- **Size:** ≤200 lines per file. Hard ceiling — not a guideline.
- **Readable:** clear, descriptive names; no magic values; no clever one-liners that obscure intent.
- **Reusable:** no copy-paste logic — extract functions for anything used more than once.
- **Modular:** single responsibility per file and per function. A file that does two things should be two files.

If the natural implementation would exceed 200 lines for any file, decompose further and raise with Old Major before proceeding.
```

After filing, update task status in `plan.json` to DISPATCHED and record `github_issue` number.

**Board parent append:** If the task's `board_parent` is a non-null integer:

Call `mcp__github__issue_read` with `owner: <ORG>`, `repo: <REPO_NAME>`, `issueNumber: <board_parent>`. Append `- [ ] #<new_issue_number> [automaton] <task title>` as a new line to the body. Call `mcp__github__issue_write` with `method: update`, `issue_number: <board_parent>`, `body: <updated_body>`.  
`# On rate_limit/secondary-rate-limit error: BODY=$(gh issue view <board_parent> --repo <REPO> --json body --jq '.body'); gh issue edit <board_parent> --repo <REPO> --body "$BODY"$'\n''- [ ] #<new_issue_number> [automaton] <task title>'`

On any error: log `"WARN: failed to update board parent #<board_parent> — <error>"` and continue. If `board_parent` is absent or null: skip silently.

**Board write:** Skip if `board_project_number` is absent from `.hall-cache/session/config.json`, or if `.hall-cache/session/board.json` is absent. Find the item in `board.json` where `issue_number` equals the filed issue number; if absent, log and skip. Resolve `field_id` and option ID for "In Progress" from `board-meta.json["fields"]["Status"]`. Call `update_item_field`: `project_id` from `board.json`, `item_id` = matched item `id`, resolved `field_id`, `value = {"singleSelectOptionId": <In Progress option ID>}`, `invoker_login` from `mcp__github__get_me` (`# On rate_limit/secondary-rate-limit error: gh api user --jq '.login'`). Log any error; do not abort dispatch.

### Step 6: Report

```
Dispatched N tasks:
  Issue #142 → Task 1 title (<specialist-A>)
  Issue #143 → Task 2 title (<specialist-B>) [filed at T+15s]

M tasks remain blocked on: [dependency list]
```

// Snowball 🐷 — the gh CLI still works; it just waits its turn now

### Step 7: Schedule autonomous advancement cron (first dispatch only)

```bash
CRON_EXISTS=$([ -f .hall-cache/session/cron.json ] && echo true || echo false)
```

If `CRON_EXISTS=false`: call `CronCreate` with:
- Schedule: `*/15 * * * *`
- Prompt: `"Autonomous plan advancement (cron): drain .hall-cache/watcher-events.jsonl then run /hall:reconcile. If any task has needs_review: true after reconcile, run /hall:review. If newly unlocked READY tasks exist, dispatch them without confirmation. Append one-line summary to .hall-cache/cron-log.md."`

Store the returned ID in `.hall-cache/session/cron.json` as `{"cron_id":"<returned ID>","created_at":"<ISO timestamp>"}`.

If `CRON_EXISTS=true`: print `Cron already active — skipping.`
