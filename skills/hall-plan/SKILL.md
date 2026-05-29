---
name: hall-plan
description: Dump the current plan as JSON, Markdown, and/or Mermaid diagram
argument-hint: [--format json|md|mermaid]
allowed-tools: [Read, Bash]
---

# /hall:plan

Force-dump the current plan. Default: all three formats. Use `--format` to select one.

## Execution

Find the active plan and read its `plan.json`.

**JSON output:** Print `plan.json` contents. Key per-task field: `task_type` (`"pr"` | `"report"`, default `"pr"`) — `"pr"` tasks open a branch and PR; `"report"` tasks post findings as an issue comment only.

**Markdown output:** Print `plan.md` contents (the human-readable rendering).

**Mermaid output:** Generate a dependency diagram:

```
flowchart LR
  t1["Task 1 title\nSpecialist-A · MERGED"] --> t3["Task 3 title\nSpecialist-C · PLANNED"]
  t2["Task 2 title\nSpecialist-B · IN_PROGRESS"] --> t3
  t1 --> t4["Task 4 title\nSpecialist-D · PLANNED"]
```

Color nodes by status: MERGED=green, IN_PROGRESS=blue, AWAITING_INPUT=yellow, BLOCKED=gray, FAILED=red, PLANNED=white.
