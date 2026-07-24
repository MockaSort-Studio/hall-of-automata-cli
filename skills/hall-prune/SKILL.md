---
name: hall-prune
description: Full clean of ~/.hall/ project directories and associated Claude memory
allowed-tools: [Bash]
---

# /hall:prune

Remove all `<org>/<slug>/` project directories from `~/.hall/` and all associated Claude memory — project and consultation artifacts. No arguments — this is a full clean.

> To clear invoker state: `hall-open --verify`
> To re-fetch personas: `hall-open --refresh`

## What gets cleaned

- All `<org>/<slug>/` directories in `~/.hall/` (and empty `<org>/` parents)
- Claude project memory: `project_<slug>*.md` in any `~/.claude/projects/*/memory/` directory
- Claude consultation memory: `consultation-*.md` in any `~/.claude/projects/*/memory/` directory

Preserved: `~/.hall/agent-index.json`, `~/.hall/agent-index.sha`.

## Execution

### 1. Collect candidates

```bash
PROJECT_DIRS=$(find ~/.hall -mindepth 2 -maxdepth 2 -type d | sort)
```

For project memory, derive `SLUG="${dir##*/}"` for each directory and scan:

```bash
find ~/.claude/projects/*/memory -name "project_${SLUG}*.md" 2>/dev/null
```

For consultation memory, scan once across all memory directories:

```bash
find ~/.claude/projects/*/memory -name "consultation-*.md" 2>/dev/null
```

### 2. Display and confirm

Print all candidate paths and their disk usage (`du -sh`). If nothing was found, print "Nothing to prune." and exit.

Prompt: `Delete all of the above? [y/N]` — exit without action on anything other than `y`.

### 3. Delete

For each project directory:
```bash
rm -rf "$dir"
rmdir --ignore-fail-on-non-empty "${dir%/*}"
```

For each matched Claude memory file (project and consultation): `rm -f "$memory_file"`.

Remove deleted entries from the `MEMORY.md` index in each affected memory directory.
