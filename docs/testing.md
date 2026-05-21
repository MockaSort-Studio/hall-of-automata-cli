# Testing the Hall of Automata Plugin

Three layers: automated structural tests, hook unit tests, and manual end-to-end smoke.

---

## Layer 1 — Automated (no Hall connection needed)

Run these from the repo root:

```bash
# Full plugin structure validation (57 checks)
bash tests/validate-plugin.sh

# Hook unit tests
bash tests/hooks/test-guard-writes.sh
bash tests/hooks/test-session-start.sh
bash tests/hooks/test-watcher.sh
bash tests/hooks/test-skill-guard.sh
```

All should exit `0`. These tests cover:
- Plugin manifest fields and path resolution
- Skill file presence and frontmatter
- Hook registration and script syntax
- Template placeholder presence
- `.gitignore` entries
- Guard-writes allow/block logic (including path traversal)
- Session-start resume prompt
- Watcher `--once` mode and PID lifecycle

---

## Layer 2 — Plugin load smoke test

```bash
cd /home/mike/Workspace/hall-of-automata-cli
cc --plugin-dir . --debug
```

In the Claude session, type `/` and verify the `hall:` commands appear in autocomplete — expected: `hall:open`, `hall:close`, `hall:doctor`, `hall:plan`, `hall:status`, `hall:dispatch`, `hall:review`, `hall:reply`, `hall:reconcile`, `hall:consultations`, `hall:prune`. The `--debug` flag shows hook registration — confirm `PreToolUse`, `SessionStart`, and `Stop` hooks are listed.

---

## Layer 3 — Manual end-to-end

These require `gh` authenticated to `MockaSort-Studio` and a valid `GITHUB_PERSONAL_ACCESS_TOKEN`.

### 3a. Doctor check

```
/hall:doctor
```

Expected: all checks green (gh auth, token, Hall repo reachable, MCP servers responding).

### 3b. Open/close lifecycle

In a scratch directory (not your real project):

```bash
mkdir /tmp/hall-test && cd /tmp/hall-test
git init
cc --plugin-dir /home/mike/Workspace/hall-of-automata-cli
```

```
/hall:open
```

Expected:
- `.hall-cache/` created
- `personas/` populated with markdown files from Hall roster
- `methodology/` populated
- `CLAUDE-stack.md` assembled with `@` imports for each discovered persona
- `claude-agents/` populated with one rendered overlay per specialist
- `watcher.pid` present
- Session stack loaded and Old Major persona active

```
/hall:close
```

Expected:
- Watcher process killed
- `CLAUDE-stack.md` and `claude-agents/` removed; plans and persona cache remain intact

### 3c. Plan and dispatch dry run

After `/hall:open`, describe a small multi-task project to Old Major:

```
/hall:plan
```

Walk through the decomposition conversation until `plan.json` is written. Inspect it:

```bash
cat .hall-cache/plans/<plan-slug>/plan.json | python3 -m json.tool
```

Verify tasks have `status`, `mode` (`doing`/`advising`/`researching`), and `repo` fields.

Mark a task READY manually to test dispatch:

```bash
# Edit plan.json: change one task's status to "READY"
```

```
/hall:dispatch
```

Expected: one GitHub issue created in the repo named in `plan.json`. Check it appeared on GitHub, then close it manually to clean up.

### 3d. Reconcile

After the issue is closed on GitHub:

```
/hall:reconcile
```

Expected: that task's status updates to `MERGED` in `plan.json`.

### 3e. Guard-writes enforcement

In an active session (after `/hall:open`), try to write outside `.hall-cache/`:

Ask Claude to write a file to your project source tree (e.g., "write 'hello' to src/test.txt"). The `guard-writes` hook should block it with an error message.

Ask Claude to write inside `.hall-cache/` — it should succeed.

---

## What to watch for

| Symptom | Likely cause |
|---|---|
| Commands missing from `/` autocomplete | Plugin not loading — check `--debug` hook output |
| `/hall:open` hangs | `gh api` call timing out — check `GITHUB_PERSONAL_ACCESS_TOKEN` |
| No `claude-agents/` overlays | Roster fetch succeeded but template render failed — check `watcher.log` |
| Guard-writes not blocking | Hook not registered — verify `hooks.json` PreToolUse matcher |
| Watcher PID file missing | `nohup` failed — run `bash hooks/scripts/watcher.sh --once` manually to see output |
