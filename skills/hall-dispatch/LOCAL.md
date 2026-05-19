---
name: hall-dispatch-local
description: Local dispatch path — inline implementation when local_mode is true
allowed-tools: [Bash, Read, Write]
---

# Local Dispatch Path

Entered from `hall-dispatch/SKILL.md` when `LOCAL_MODE=True`. Do not open GitHub Issues or PRs.

## Step L1: Load specialist persona

Identify the specialist for the task. Read `.hall-cache/personas/<specialist>.md`. If absent, fetch first:

```bash
gh api "repos/MockaSort-Studio/hall-of-automata/contents/roster/<specialist>.md" \
  --jq '.content' | base64 -d > ".hall-cache/personas/<specialist>.md"
```

## Step L2: Planning discipline

Before touching any file (from `automaton_base.md`):
1. State task understanding in 2–3 sentences.
2. List files to touch and why.
3. Name one risk.

## Step L3: Implement

Use the specialist's domain methodology and coding standards. Stay as Old Major — do not adopt the specialist's voice. Work in the current repo only.

If the task requires pushing to an external repo, skip to L5 with `Status: BLOCKED`.

## Step L4: Commit to local branch

```bash
SLUG=$(echo "<task-title>" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/-$//')
git checkout -b "local/$SLUG"
git add -A
git commit -m "<task-title>

Co-authored-by: Old Major <hall-of-automata[bot]@users.noreply.github.com>"
```

## Step L5: Write result artifact

Write `.hall-cache/plans/<plan-slug>/local-runs/<task-id>/result.md`:

```
# Local Run: <task-id>
Persona consulted: <specialist>
Branch: local/<slug>
Status: DONE | BLOCKED | PARTIAL
Summary: <one paragraph>
Files changed:
- path/to/file — what changed
```

## Step L6: No GitHub filing

Do not open a GitHub Issue or PR. Do not apply `hall:` labels.

## Step L7: Propose next set

Propose the next ready set. Wait for explicit confirmation before proceeding.
