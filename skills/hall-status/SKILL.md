---
name: hall-status
description: Render the current plan board showing task states
allowed-tools: [Bash, Read]
---

# /hall:status

Render the current plan board on demand.

## Execution

Find the active plan (most recent for this repo by directory name):

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
ls -d ~/.hall/projects/$SLUG/plans/*/ 2>/dev/null | sort | tail -1
```

Read `plan.json` and render a board grouped by status:

**In progress** — DISPATCHED or IN_PROGRESS tasks, with issue numbers and links
**Awaiting input** — AWAITING_INPUT tasks, with the question the specialist asked
**Blocked** — BLOCKED tasks, with what they're waiting for
**Ready to dispatch** — PLANNED tasks whose dependencies are all MERGED
**Done** — MERGED tasks (collapsed to count unless `--verbose`)
**Failed** — FAILED or ESCALATED tasks

End with a summary line: `N tasks in flight · M blocked · K merged · P failed`

If no active plan exists, say so and suggest running `/hall:open` to start one.
