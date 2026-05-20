# Hall CLI Bug Fixes — Design Spec
<!-- 2026-05-20 -->

## Scope

Four targeted fixes across six bugs in the Hall CLI plugin. All changes are to skill files and plugin.json — no new files, no new infrastructure.

---

## Task A — Cron lifecycle (Bugs 1, 2, 3)

### Problem

- `hall-open` Step 6 creates the reconcile cron whenever any non-DONE plan directory exists, including plans that have never been dispatched. Idle plans spin up a live loop with no work to do.
- `hall-close` Step 1.5 has shell plumbing to read `cron.json` but the `CronDelete` call is a comment — it never fires.
- `hall-reconcile` never cancels the cron when it marks a plan DONE.
- The cron prompt says to dispatch "newly unlocked tasks" but omits review dispatch — when `needs_review: true` tasks exist after reconcile, the review pipeline (hall-dispatch Step 0) never runs.

### Fix

**`skills/hall-open/SKILL.md`** — Delete Step 6 entirely. No cron at session open.

**`skills/hall-dispatch/SKILL.md`** — After Step 5 (issues filed), add cron creation:
- Check for existing `cron.json`; if present and valid, skip.
- Call `CronCreate` with schedule `*/15 * * * *` and prompt:
  > "Autonomous plan advancement (cron): drain `.hall-cache/watcher-events.jsonl`, run `/hall:reconcile`. If any task has `needs_review: true` after reconcile, run `/hall:dispatch` (Step 0 only — review dispatch). If newly unlocked READY tasks exist, dispatch them without confirmation. Append one-line summary to `.hall-cache/cron-log.md`."
- Write returned ID to `.hall-cache/session/cron.json`.

**`skills/hall-close/SKILL.md`** — Fix Step 1.5 to invoke `CronDelete` with the ID from `cron.json` (currently a comment, must become a real tool call).

**`skills/hall-reconcile/SKILL.md`** — After writing `plan.json`, check if all tasks are now MERGED/DONE. If so: read `cron.json`, call `CronDelete`, remove the file, log cancellation.

### Invariants

- At most one cron active per session.
- Cron is tied to dispatched plan execution, not plan existence.
- Cron is cancelled by: plan completion (reconcile), session close (hall-close). Not by hall-open or hall-prune.

---

## Task B — Plugin permissions at install time (Bug 4)

### Problem

`plugin.json` is a metadata stub with no `permissions` declaration. The full permission set (from `templates/claude-settings.json`) is only applied by `hall-open` at runtime, and only if `.claude/settings.json` doesn't yet exist. Users who install the plugin and invoke it without first running `/hall:open` get permission prompts.

### Fix

**`.claude-plugin/plugin.json`** — Add `permissions.allow` array matching `templates/claude-settings.json`:

```json
"permissions": {
  "allow": [
    "Bash(*)", "Read", "Write", "Edit", "MultiEdit",
    "Glob", "Grep", "WebFetch", "WebSearch",
    "Agent", "Skill", "AskUserQuestion", "ToolSearch",
    "TodoRead", "TodoWrite",
    "CronCreate", "CronDelete", "CronList",
    "ScheduleWakeup", "Monitor",
    "TaskCreate", "TaskUpdate", "TaskGet", "TaskList", "TaskOutput", "TaskStop",
    "EnterPlanMode", "ExitPlanMode", "EnterWorktree", "ExitWorktree",
    "NotebookEdit", "PushNotification", "RemoteTrigger",
    "mcp__github__*",
    "mcp__plugin_hall-of-automata_github__*",
    "mcp__fetch__fetch",
    "mcp__sequential-thinking__sequentialthinking"
  ]
}
```

Keep the runtime copy in `hall-open` Step 3 as a fallback for users with stale installs.

---

## Task C — Code quality terms in every dispatch issue (Bug 5)

### Problem

The `## Code quality` section in the hall-dispatch Step 5 issue template is vague and omits readability, reusability, and modularity. It also doesn't state these as constraints that apply regardless of technology.

### Fix

**`skills/hall-dispatch/SKILL.md`** — Replace the `## Code quality` block in the issue body template:

```markdown
## Code quality

Applies to all files produced by this task, regardless of language or framework:

- **Size:** ≤200 lines per file. Hard ceiling — not a guideline.
- **Readable:** clear, descriptive names; no magic values; no clever one-liners that obscure intent.
- **Reusable:** no copy-paste logic — extract functions for anything used more than once.
- **Modular:** single responsibility per file and per function. A file that does two things should be two files.

If the natural implementation would exceed 200 lines for any file, decompose further and raise with Old Major before proceeding.
```

---

## Task D — Link board to repo after creation (Bug 6)

### Problem

`hall-init-board` Step 3 calls `createProjectV2` with the org/user node ID. This creates a floating org-level project. GitHub Projects v2 supports linking a project to a specific repository via `linkProjectV2ToRepository`. Without this call, the board does not appear in the repo's Projects tab.

### Fix

**`skills/hall-init-board/SKILL.md`** — After `createProjectV2` succeeds in Step 3, add:

```bash
REPO_ID=$(gh api graphql \
  -f query='query($o:String!,$r:String!){repository(owner:$o,name:$r){id}}' \
  -F o="$OWNER" -F r="$(echo $REPO | cut -d/ -f2)" \
  --jq '.data.repository.id')

gh api graphql \
  -f query='mutation($p:ID!,$r:ID!){linkProjectV2ToRepository(input:{projectId:$p,repositoryId:$r}){repository{name}}}' \
  -F p="$PROJECT_ID" -F r="$REPO_ID" --jq '.data.linkProjectV2ToRepository.repository.name'

echo "Board linked to repository ${REPO}."
```

---

## Routing

All four tasks → **Snowball** (Hall infrastructure, bash + markdown skill files).

## Out of scope

- Changing the reconcile polling interval.
- Any change to the watcher or guard-writes hook.
- New skill files or new MCP tools.
