---
name: hall-prune
description: Age out stale plan directories from ~/.hall/
argument-hint: "--plans <age-in-days>"
allowed-tools: [Bash]
---

# /hall:prune

Remove old plan directories from `~/.hall/$SLUG/plans/*/`.

> To clear invoker state: `hall-open --verify`
> To re-fetch personas: `hall-open --refresh`

## --plans <days>

List plan directories older than N days where all tasks are MERGED or DONE. Show candidate paths and sizes. Prompt: "Delete these N directories? [y/N]" — exit without action on anything other than `y`.

```bash
find ~/.hall/*/*/plans -maxdepth 1 -type d -mtime +<N> | sort
```

Never prune the most recent plan per project regardless of age.
