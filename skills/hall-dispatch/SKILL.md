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

```bash
REPO=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
ORG="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
```

### Step 0: Determine the ready set

No local plan file — the ready set is derived live from GitHub. A candidate is an open issue with no `hall:<specialist>` label yet (undispatched):

```bash
gh issue list --repo "$REPO" --state open --json number,title,labels,milestone --limit 200 \
  --jq '[.[] | select([.labels[].name] | any(startswith("hall:")) | not)]' \
  > /tmp/hall-candidates.json
```

For each candidate, check whether it is still blocked:

```bash
gh api "repos/$REPO/issues/<N>/dependencies/blocked_by" --jq '[.[] | select(.state=="open")] | length'
```

`0` → ready. `> 0` → still blocked, note the blocking issue numbers for the report in Step 5.

If `--single` is specified, use only that task (verify it's in a dispatchable state — not already labeled, not blocked).

### Step 1: Check quota

Call `mcp__github__list_issues` with `owner: <ORG>`, `repo: <REPO_NAME>`, `labels: ["hall:in-progress"]`. Count the returned items.
`# On rate_limit/secondary-rate-limit error: gh issue list --repo <ORG/REPO> --label "hall:in-progress" --json number | jq length`

If the ready set exceeds estimated available capacity, display:
> "N tasks ready, estimated pool capacity is M. Recommend filing M now and holding N-M as deferred. Proceed with recommendation, or file all N?"

Default: the steward path (file up to capacity).

### Step 2: Query prior context (per-task)

Read `skills/hall-dispatch/prior-context.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute exactly as specified.

### Step 3: Confirmation summary

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

### Step 4: File issues

For each task in dispatch order, spaced 15 seconds apart:

**Origination mode** — determines whether to create a new issue or route to an existing one:

- **Board-sourced** (from Step 0's ready set): the issue was already filed by `hall-okr`/`hall-decompose`. Apply `hall:<specialist>` label to the existing issue: `gh issue edit <issue_num> --repo <ORG/REPO> --add-label "hall:<specialist>"`. Skip issue creation.
- **Ad-hoc** (a bugfix/hotfix Old Major is dispatching directly from conversation, per the OKR gate — no pre-filed issue exists): create the issue via `mcp__github__issue_write` with `owner: <ORG>`, `repo: <REPO_NAME>`, `method: create`, `title: "<task title>"`, `labels: ["hall:<specialist>"]`, `body: "<issue body>"`. Capture the returned number as `ISSUE_NUM`.
  `# On rate_limit/secondary-rate-limit error: gh api repos/<ORG>/<REPO>/issues -f title="<task title>" -f body="<issue body>" -f 'labels[]=hall:<specialist>' --jq '.number'`
  After filing: read `skills/hall-dispatch/board-provision.md` and execute with `ISSUE_NUM=<returned number>`,
  `ITEM_TYPE=Bug`, `SAGA_MILESTONE_TITLE=<saga name from dispatch-context if saga is linked; otherwise "">`,
  `BLOCKED_BY_LIST=<dependent issue numbers named in conversation; otherwise "">`.
  Run board-provision before board-write below.

**Issue body** — load by `task_type`:
- `task_type: "pr"` (or absent): Read `templates/dispatch-body-pr.md.tpl` (resolve against `$CLAUDE_PLUGIN_ROOT`). Substitute all placeholders before filing.
- `task_type: "report"`: Read `templates/dispatch-body-report.md.tpl` (resolve against `$CLAUDE_PLUGIN_ROOT`). Substitute all placeholders before filing.

**Board write:** Read `skills/hall-dispatch/board-write.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute the **dispatch-write** procedure. For CLI-flow issues, this transitions the board item from Backlog (set by board-provision) to In Progress.

### Step 5: Report

```
Dispatched N tasks:
  Issue #142 → Task 1 title (<specialist-A>)
  Issue #143 → Task 2 title (<specialist-B>) [filed at T+15s]

M tasks remain blocked on: [dependency list]
```

### Step 6: Schedule autonomous advancement cron (first dispatch only)

Read `skills/hall-dispatch/cron-setup.md` (resolve against `$CLAUDE_PLUGIN_ROOT`) and execute exactly as specified.
