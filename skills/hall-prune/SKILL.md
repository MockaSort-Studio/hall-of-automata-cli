---
name: hall-prune
description: Clean up old plan directories or stale persona cache from .hall-cache/
argument-hint: [--invoker] [--plans <age-in-days>] [--cache]
allowed-tools: [Bash, Write]
---

# /hall:prune

Clean up older plans or stale cache from `.hall-cache/`.

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
[ -f .hall-cache/invoker.json ] && rm .hall-cache/invoker.json
echo "Invoker cache cleared. Run /hall:open to re-verify."
```

Exit immediately after. Do not proceed to `--plans` or `--cache` logic.

## --plans <days>

List plan directories older than N days. Show sizes. Ask for confirmation before removing.

```bash
find .hall-cache/plans -maxdepth 1 -type d -mtime +<N> | sort
```

Never prune the most recent plan regardless of age.

`.hall-cache/invoker.json` is not touched by this step.

## --cache

Remove `.hall-cache/personas/` (forces a fresh fetch on next `/hall:open`).

```bash
rm -rf .hall-cache/personas/
echo "Persona cache cleared. Next /hall:open will re-fetch."
```

`.hall-cache/invoker.json` is not touched by this step.
