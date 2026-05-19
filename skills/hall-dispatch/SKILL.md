---
name: hall-dispatch
description: Dispatch ready tasks to the Hall as GitHub Issues with quota stewardship
argument-hint: [--single <task_id>] [--dry-run]
allowed-tools: [Bash, Read, Write]
---

# /hall:dispatch

Dispatch ready tasks to the Hall. Old Major normally proposes this in conversation after showing the confirmation summary; use this command for explicit control.

- `--single <task_id>`: dispatch one specific task regardless of ready-set state
- `--dry-run`: preview the issues that would be created without filing them

## Execution

### Step 0: Review dispatch

Using the active plan's `plan.json` (located as in Step 3), collect all tasks where `needs_review: true`. If none, skip to Step 1.

For each such task, in order:

#### 0a. Locate the PR

```bash
gh pr list --repo <REPO> --search "closes #<ISSUE_NUMBER> is:open" \
  --json number,headSha --jq '.[0]'
```

Empty result: print `Task <id> has needs_review but no open PR — skipping.` and move to next task.

#### 0b. Render the reviewer overlay

```bash
python3 << 'PYEOF'
import json, os
plugin_root = os.environ.get('CLAUDE_PLUGIN_ROOT', '.')
cache_root = '.hall-cache'
specialist = '<SPECIALIST>'  # substitute task['specialist']
persona_path = f'{cache_root}/personas/{specialist}.md'
with open(f'{plugin_root}/templates/reviewer-overlay.md.tpl') as f:
    template = f.read()
with open(persona_path) as f:
    lines = [l.rstrip() for l in f if l.strip()]
description = next((l.lstrip('# ') for l in lines if l.startswith('#')), specialist)
content = (template
    .replace('{{SPECIALIST_NAME}}', specialist)
    .replace('{{SPECIALIST_DESCRIPTION}}', description)
    .replace('{{PERSONA_PATH}}', persona_path)
    .replace('{{CACHE_ROOT}}', cache_root))
os.makedirs(f'{cache_root}/session/claude-agents', exist_ok=True)
with open(f'{cache_root}/session/claude-agents/{specialist}-reviewer.md', 'w') as f:
    f.write(content)
PYEOF
```

#### 0c. Spawn reviewer subagent

Spawn `.hall-cache/session/claude-agents/<specialist>-reviewer.md`. Treat `review_cycle` as 1 if the task entry does not carry it.

Prompt:
> "Review PR #<PR_NUMBER> in <REPO> which addresses issue #<ISSUE_NUMBER>. This is review cycle <review_cycle> of 2."

Wait for the subagent to return. Its output is the verdict comment block.

#### 0d. Post verdict comment

```bash
gh pr comment <PR_NUMBER> --repo <REPO> --body "<verdict_text>"
```

#### 0e. Route by verdict

Read the `VERDICT:` line from the returned block:

- **LGTM** → go to 0f.
- **MINOR** and `review_cycle == 1` → REFINE: post a PR comment directing the specialist to address findings and push a fix commit. In `plan.json`: set `review_cycle: 2`, `needs_review: false`, status `REVIEWING`. Write `plan.json`. Move to next task.
- **MINOR** and `review_cycle == 2` (ASSESS-2) → go to 0f.
- **MAJOR** or **BLOCKED** → go to 0f with escalation.

#### 0f. SETTLE

Read `automation_level` from `.hall-cache/session/config.json`.

| Verdict | Level | Action |
|---------|-------|--------|
| LGTM | 2 | `gh pr merge --merge --repo <REPO> <PR_NUMBER>` — set status `DONE`, clear `needs_review` |
| LGTM | 0 or 1 | Print: `PR #<N> is LGTM — please review and merge. Task remains REVIEWING.` |
| MINOR (ASSESS-2), MAJOR, BLOCKED | any | Print verdict summary and findings. Set status `ESCALATED`. Clear `needs_review`. |

Write `plan.json`.

#### 0g. Summary

After processing all `needs_review` tasks, print:

```
Review dispatch complete: N reviewed, M settled (DONE/ESCALATED), K pending REFINE.
```

Continue to Step 1.

### Step 1: Reconcile

Run the reconcile procedure from `/hall:reconcile` before proceeding.

### Step 2: Determine the ready set

Tasks with status READY (deferred) or PLANNED whose `depends_on` entries are all MERGED.

If `--single` is specified, use only that task (verify it's in a dispatchable state).

### Step 3: Check quota

```bash
# Count open Hall issues on this repo (rough pool usage proxy)
Read `repo` from the active plan's `plan.json` (e.g. `python3 -c "import json; print(json.load(open(PLAN_DIR+'plan.json'))['repo'])"`) and substitute it for `<ORG/REPO>` throughout.
gh issue list --repo <ORG/REPO> \
  --label "hall:in-progress" --json number | jq length
```

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

```bash
gh issue create \
  --repo <ORG/REPO> \
  --title "<task title>" \
  --label "hall:<specialist>" \
  --body "<issue body>"
```

Issue body format:
```
<!-- Hall dispatch by Old Major (Session Mode) -->

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

All files produced by this task must be small enough for a human to review in one read (~200 lines hard ceiling). Prefer many small, focused files over fewer large ones. No duplicated logic. If a natural implementation would exceed this, decompose further and raise with Old Major before proceeding.
```

After filing, update task status in `plan.json` to DISPATCHED and record `github_issue` number.

**Board write:** Skip if `board_project_number` is absent from `.hall-cache/session/config.json`, or if `.hall-cache/session/board.json` is absent. Find the item in `board.json` where `issue_number` equals the filed issue number; if absent, log and skip. Resolve `field_id` and option ID for "In Progress" from `board-meta.json["fields"]["Status"]`. Call `update_item_field`: `project_id` from `board.json`, `item_id` = matched item `id`, resolved `field_id`, `value = {"singleSelectOptionId": <In Progress option ID>}`, `invoker_login` from `gh api user --jq '.login'`. Log any error; do not abort dispatch.

### Step 6: Report

```
Dispatched N tasks:
  Issue #142 → Task 1 title (<specialist-A>)
  Issue #143 → Task 2 title (<specialist-B>) [filed at T+15s]

M tasks remain blocked on: [dependency list]
```
