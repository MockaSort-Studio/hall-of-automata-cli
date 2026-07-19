---
name: hall-dispatch
description: Dispatch ready tasks to the Hall as GitHub Issues with quota stewardship
argument-hint: "[--single <task_id>] [--dry-run]"
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
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
LOCAL_MODE=$(python3 -c "
import json, os; slug='$SLUG'
try: print(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/config.json'))).get('local_mode',False))
except: print(False)
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
PLAN_DIR=$(ls -d ~/.hall/projects/$SLUG/plans/*/ | sort | tail -1)
Read `repo` from the active plan's `plan.json` (e.g. `python3 -c "import json; print(json.load(open('$PLAN_DIR'+'plan.json'))['repo'])"`) and substitute it for `<ORG/REPO>` throughout.
```
Call `mcp__github__list_issues` with `owner: <ORG>`, `repo: <REPO_NAME>`, `labels: ["hall:in-progress"]`. Count the returned items.  
`# On rate_limit/secondary-rate-limit error: gh issue list --repo <ORG/REPO> --label "hall:in-progress" --json number | jq length`

If the ready set exceeds estimated available capacity, display:
> "N tasks ready, estimated pool capacity is M. Recommend filing M now and holding N-M as deferred. Proceed with recommendation, or file all N?"

Default: the steward path (file up to capacity).

### Step 3b: Query prior context (per-task)

Read `skills/hall-dispatch/prior-context.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute exactly as specified.

### Step 4: Confirmation summary

Display before any filing:

```
Ready to dispatch N tasks:

  Task 1 title → <specialist-A> (hall:<specialist-A>) [doing]
    Routing: <rationale>.
  Task 2 title → <specialist-B> (hall:<specialist-B>) [reporting]
    Routing: <rationale>.

Dispatch order: Task 1 at T+0, Task 2 at T+15s (15s inter-dispatch jitter).
Estimated turn budget: ~40 turns per task.

Proceed? [y/N]
```

Label: `[doing]` when `task_type: "pr"` (or absent); `[reporting]` when `task_type: "report"`.

If `--dry-run`, show the confirmation summary and the issue bodies that would be created, then stop.

### Step 5: File issues

For each task in dispatch order, spaced 15 seconds apart:

**Pre-check — pre-filed issue:**

```bash
GITHUB_ISSUE=$(python3 -c "import json; t=next((x for x in json.load(open('${PLAN_DIR}plan.json')).get('tasks',[]) if x['id']=='<task_id>'),{}); print(t.get('github_issue',''))" 2>/dev/null || echo "")
```

If `GITHUB_ISSUE` is non-empty: `gh issue edit $GITHUB_ISSUE --repo <ORG/REPO> --add-label "hall:<specialist>"`, update task status to DISPATCHED in `plan.json`, skip issue creation and board steps, continue to next task.
If empty: proceed with issue creation below.

Call `mcp__github__issue_write` with `owner: <ORG>`, `repo: <REPO_NAME>`, `method: create`, `title: "<task title>"`, `labels: ["hall:<specialist>"]`, `body: "<issue body>"`.
`# On rate_limit/secondary-rate-limit error: gh api repos/<ORG>/<REPO>/issues -f title="<task title>" -f body="<issue body>" -f 'labels[]=hall:<specialist>' --jq '.number'`

Issue body — select by `task_type` (default `"pr"`):

**PR body** (`task_type: "pr"` or absent):
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

## Prior context

<from Step 3b — omit section entirely if no relevant prior issues found>

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

**Report body** (`task_type: "report"`):
```
<!-- Hall dispatch by Old Major (Session Mode) -->

## Summary

<one paragraph description of the task>

## Output

Post your findings as a comment on this issue. Do not open a branch or PR.

## Acceptance criteria

<what done looks like>

## Context

<relevant context the specialist needs — existing code references, design decisions, constraints>

## Prior context

<from Step 3b — omit section entirely if no relevant prior issues found>

## Routing

Assigned to <Specialist>. Rationale: <routing_rationale text>

## Dependencies

<list of parent tasks that have completed, with their PR links>
```

After filing, update task status in `plan.json` to DISPATCHED and record `github_issue` number.

**Board parent append:** If the task's `board_parent` is a non-null integer:

Call `mcp__github__issue_read` with `owner: <ORG>`, `repo: <REPO_NAME>`, `issueNumber: <board_parent>`. Append `- [ ] #<new_issue_number> [automaton] <task title>` as a new line to the body. Call `mcp__github__issue_write` with `method: update`, `issue_number: <board_parent>`, `body: <updated_body>`.
`# On rate_limit/secondary-rate-limit error: BODY=$(gh issue view <board_parent> --repo <REPO> --json body --jq '.body'); gh issue edit <board_parent> --repo <REPO> --body "$BODY"$'\n''- [ ] #<new_issue_number> [automaton] <task title>'`

On any error: log `"WARN: failed to update board parent #<board_parent> — <error>"` and continue. If `board_parent` is absent or null: skip silently.

**Board write:** `BOARD_ACTIVE=$(python3 -c "import json,os; slug='$SLUG'; print(bool(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/config.json'))).get('board_project_number','')))" 2>/dev/null || echo False)` — skip if `False` or `~/.hall/projects/$SLUG/board.json` absent. Find item in `board.json` where `issue_number` matches filed issue; if absent log `"Board item not found for issue #<N>"` and skip; set `ITEM_ID` from item `id`. Resolve and inline via `python3` (`singleSelectOptionId` must be literal in the query — GitHub Projects API rejects GraphQL variables for this field):
`INPROG_OPT=$(python3 -c "import json,os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/board-meta.json')))['fields']['Status']['options']['In Progress'])"); PROJ_ID=$(python3 -c "import json,os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/board.json')))['project_id'])"); FIELD_ID=$(python3 -c "import json,os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/projects/{slug}/board-meta.json')))['fields']['Status']['id'])"); gh api graphql -f query="mutation{updateProjectV2ItemFieldValue(input:{projectId:\"${PROJ_ID}\",itemId:\"${ITEM_ID}\",fieldId:\"${FIELD_ID}\",value:{singleSelectOptionId:\"${INPROG_OPT}\"}}){projectV2Item{id}}}"`
Log any error and continue — do not abort dispatch.

### Step 6: Report

```
Dispatched N tasks:
  Issue #142 → Task 1 title (<specialist-A>)
  Issue #143 → Task 2 title (<specialist-B>) [filed at T+15s]

M tasks remain blocked on: [dependency list]
```

// Snowball 🐷 — the gh CLI still works; it just waits its turn now

### Step 7: Schedule autonomous advancement cron (first dispatch only)

Read `skills/hall-dispatch/cron-setup.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute exactly as specified.
