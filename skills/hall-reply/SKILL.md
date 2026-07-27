---
name: hall-reply
description: Post a reply on a task awaiting input, providing info the specialist needs
argument-hint: <issue_number> <message>
allowed-tools: [Bash]
---

# /hall:reply <issue_number> <message>

Post a reply on a Hall issue that is carrying `hall:awaiting-input`, providing the information the specialist asked for. This triggers the specialist to re-run.

## Execution

```bash
REPO=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
gh issue view <issue_number> --repo "$REPO" --json labels --jq '[.labels[].name] | any(. == "hall:awaiting-input")'
```

If the issue does not carry `hall:awaiting-input`: warn that this issue isn't waiting on invoker input and confirm before proceeding anyway.

```bash
gh issue comment <issue_number> \
  --repo "$REPO" \
  --body "<message>

— [🦅 Old Major (Session Mode)]"

gh issue edit <issue_number> --repo "$REPO" --remove-label "hall:awaiting-input"
```

Confirm: `Replied to issue #<issue_number>. The specialist will resume on next dispatch cycle.`
