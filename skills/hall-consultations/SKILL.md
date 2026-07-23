---
name: hall-consultations
description: List, view, or prune saved Tier-2 subagent consultation outputs
argument-hint: "list|view <id>|prune [--older-than <days>]"
allowed-tools: [Read, Bash, Write]
---

# /hall:consultations [list|view <id>|prune]

Manage saved Tier-2 subagent consultation outputs.

## list (default)

```bash
SLUG=$(cat ~/.hall/session/.repo-slug 2>/dev/null || echo "")
find ~/.hall/$SLUG/plans -name "*.md" -path "*/consultations/*" | sort
```

Display as a table: plan, filename, approximate size, date.

## view <id>

Read and display the consultation file. `<id>` can be a filename or a partial match.

## prune [--older-than <days>]

Remove consultation files older than N days (default: 90). List files to be removed and ask for confirmation before deleting.
