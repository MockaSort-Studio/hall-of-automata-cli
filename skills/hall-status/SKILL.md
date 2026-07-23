---
name: hall-status
description: Render the current plan board or dump plan data in a specified format
argument-hint: [--format json|md|mermaid]
allowed-tools: [Bash, Read]
---

# /hall:status

Render the current plan board. Use `--format` to dump plan data in an alternate format.

## Find the active plan

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
ls -d ~/.hall/$SLUG/plans/*/ 2>/dev/null | sort | tail -1
```

If no active plan exists, say so and suggest running `/hall:open` to start one.

## Default (no flag): board view

Read `plan.json` and render a board grouped by status:

**In progress** — DISPATCHED or IN_PROGRESS tasks, with issue numbers and links
**Awaiting input** — AWAITING_INPUT tasks, with the question the specialist asked
**Blocked** — BLOCKED tasks, with what they're waiting for
**Ready to dispatch** — PLANNED tasks whose dependencies are all MERGED
**Done** — MERGED tasks (collapsed to count unless `--verbose`)
**Failed** — FAILED or ESCALATED tasks

End with a summary line: `N tasks in flight · M blocked · K merged · P failed`

## --format json

Print `plan.json` as pretty-printed JSON. Key per-task field: `task_type` (`"pr"` | `"report"`, default `"pr"`) — `"pr"` tasks open a branch and PR; `"report"` tasks post findings as an issue comment only.

## --format md

Print `plan.md` contents (the human-readable rendering).

## --format mermaid

Generate a dependency diagram:

```
flowchart LR
  t1["Task 1 title\nSpecialist-A · MERGED"] --> t3["Task 3 title\nSpecialist-C · PLANNED"]
  t2["Task 2 title\nSpecialist-B · IN_PROGRESS"] --> t3
  t1 --> t4["Task 4 title\nSpecialist-D · PLANNED"]
```

Color nodes by status: MERGED=green, IN_PROGRESS=blue, AWAITING_INPUT=yellow, BLOCKED=gray, FAILED=red, PLANNED=white.
