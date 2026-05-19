---
name: hall-prune
description: Clean up old plan directories or stale persona cache from .hall-cache/
argument-hint: [--plans <age-in-days>] [--cache]
allowed-tools: [Bash, Write]
---

# /hall:prune

Clean up older plans or stale cache from `.hall-cache/`.

## --plans <days>

List plan directories older than N days. Show sizes. Ask for confirmation before removing.

```bash
find .hall-cache/plans -maxdepth 1 -type d -mtime +<N> | sort
```

Never prune the most recent plan regardless of age.

## --cache

Remove `.hall-cache/personas/` (forces a fresh fetch on next `/hall:open`).

```bash
rm -rf .hall-cache/personas/
echo "Persona cache cleared. Next /hall:open will re-fetch."
```
