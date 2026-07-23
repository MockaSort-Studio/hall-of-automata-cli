---
name: hall-prune
description: Age out stale <org>/<slug>/ project directories from ~/.hall/
argument-hint: "--stale <age-in-days>"
allowed-tools: [Bash]
---

# /hall:prune

Remove stale project directories from `~/.hall/<org>/<slug>/`.

A directory is stale when its `config.json` has not been modified in more than N days.

> To clear invoker state: `hall-open --verify`
> To re-fetch personas: `hall-open --refresh`

## --stale <days>

List `<org>/<slug>/` directories whose `config.json` is older than N days. Show candidate paths and sizes. Prompt: "Delete these N directories? [y/N]" — exit without action on anything other than `y`.

```bash
find ~/.hall -mindepth 3 -maxdepth 3 -name config.json -mtime +<N> \
  | sed 's|/config.json$||' | sort
```

Never prune the currently active project. Read `~/.hall/session/.repo-slug` — skip any `<org>/<slug>` entry that matches.

When deleting: remove the entire `<org>/<slug>/` directory. If the parent `<org>/` directory is then empty, remove it too.
