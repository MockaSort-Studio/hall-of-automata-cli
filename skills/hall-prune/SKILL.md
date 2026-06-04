---
name: hall-prune
description: Clean up old plan directories or stale persona cache from ~/.hall/
argument-hint: "[--invoker] [--plans <age-in-days>] [--cache]"
allowed-tools: [Bash, Write]
---

# /hall:prune

Clean up older plans or stale cache from `~/.hall/`.

## Flag detection

Run this first, before any other logic:

```bash
RESET_INVOKER=false
for arg in "$@"; do
  [ "$arg" = "--invoker" ] && RESET_INVOKER=true
done
```

## --invoker

Reset the invoker-status cache. Use this after joining `automata-invokers` or switching orgs.

If `RESET_INVOKER=true`:

```bash
[ -f ~/.hall/invoker.json ] && rm ~/.hall/invoker.json
echo "Invoker cache cleared. Run /hall:open to re-verify."
```

Exit immediately after. Do not proceed to `--plans` or `--cache` logic.

## --plans <days>

List plan directories older than N days across all project namespaces. Show sizes. Ask for confirmation before removing.

```bash
find ~/.hall/projects/*/plans -maxdepth 1 -type d -mtime +<N> | sort
```

Never prune the most recent plan per project regardless of age.

`~/.hall/invoker.json` is not touched by this step.

## --cache

Remove `~/.hall/personas/` (forces a fresh fetch on next `/hall:open`).

```bash
rm -rf ~/.hall/personas/
echo "Persona cache cleared. Next /hall:open will re-fetch."
```

`~/.hall/invoker.json` is not touched by this step.
