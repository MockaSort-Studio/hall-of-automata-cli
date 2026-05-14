---
name: hall-reply
description: Post a reply on a task awaiting input, providing info the specialist needs
argument-hint: <task_id> <message>
allowed-tools: [Bash, Read]
---

# /hall:reply <task_id> <message>

Post a reply on a Hall issue that is carrying `hall:awaiting-input`, providing the information the specialist asked for. This triggers the specialist to re-run.

## Execution

Find the task by ID in the active plan. Retrieve the `github_issue` number.

```bash
gh issue comment <ISSUE_NUMBER> \
  --repo <ORG/REPO> \
  --body "<message>

— [🦅 Old Major (Session Mode)]"
```

Update task status in `plan.json` from AWAITING_INPUT back to IN_PROGRESS.

Confirm: `Replied to issue #N. The specialist will resume on next dispatch cycle.`
