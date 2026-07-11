---
name: create-sub-issues
description: Decompose a parent issue into native GitHub sub-issues and post a routing plan
allowed-tools: [mcp__github__*]
---

# /create-sub-issues

Run after the routing plan is decided, before any `hall:` labels are applied.

## When to use

Task decomposition is complete and you have a confirmed routing plan. Create sub-issues now — do not dispatch until the invoker labels them.

## Execution

### Step 1: Create each sub-issue

Call `mcp__github__create_issue` for each sub-task:

- `owner`, `repo`: target repository
- `title`: sub-task title
- `body`: task description and acceptance criteria

Record the returned `id` (numeric) and `number` for each issue.

### Step 2: Link to parent

Immediately after creation, call `mcp__github__add_sub_issue`:

- `owner`, `repo`: target repository
- `issue_number`: parent issue number
- `sub_issue_id`: the `id` returned in Step 1 — not the `number`

Repeat Steps 1–2 for each sub-issue before moving on.

### Step 3: No labels — hard constraint

Do NOT apply any `hall:` labels to sub-issues at creation time.

The invoker controls dispatch sequence by labeling sub-issues one at a time. Applying labels here triggers parallel agent dispatches with no shared state, producing racing PRs and merge conflicts.

### Step 4: Post routing plan on parent

Call `mcp__github__add_issue_comment` on the parent issue. Include:

- What each sub-issue covers (`#number` — `title`)
- Recommended execution order and rationale
- Dependencies between sub-tasks the invoker must serialize

### Step 5: Write dispatch result

```json
{"outcome":"comment_posted","pr_number":"","branch":""}
```
