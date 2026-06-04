# Hall CLI — Standalone Mode (Revision 2)

**Date:** 2026-06-03  
**Status:** IN PROGRESS — PRs 1–4 merged; PR 5 (docs) dispatched (#144); follow-up #143 open

---

## Problem Statement

Hall CLI requires a local repo checkout to operate. Users must have the target repository cloned before opening a session, which prevents standalone use and creates a separate persona/methodology cache per repo.

**Core assumption:** a global session cache eliminates the repo requirement without changing the user flow. The in-repo path must work identically after migration — no regressions.

### What this adds

- Open a Hall session from any directory, without a local repo clone
- Project picker: select target org and repo via `AskUserQuestion` at session open
- Shared persona and methodology cache across all projects (`~/.hall/personas/`, `~/.hall/methodology/`) — fetched once, reused everywhere
- Target repo's `CLAUDE.md` fetched and cached for context synthesis in standalone mode

### What this does not change

- In-repo session flow — identical post-migration
- Specialist dispatch mechanics, plan structure, reconcile/review cycles
- All existing plans and session data (stored in new location; old `.hall-cache/` orphaned, removable manually)

---

## Design Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Cache location | `~/.hall/` — user home, flat structure | OS-aware via `os.path.expanduser` / `$HOME`; no per-project subdirectory needed; no Claude internal path dependency |
| 2 | Per-project isolation | None — single flat root | `personas/` and `methodology/` are Hall-wide; `session/` is one active session; `plans/` are date-slug named and already disambiguate |
| 3 | Runtime path resolution | Fixed constant — no pointer file, no slug | Flat root means no runtime lookup; every script and hook uses the same literal path |
| 4 | Hook compatibility | Absolute-path check in `guard-writes.sh` before normalization | `realpath -m --relative-to=.` turns `~/.hall/...` into `../../.hall/...`; naive constant replace would silently block all global cache writes |
| 5 | CLAUDE.md passive loading | Dropped | Relative path no longer resolves; absolute @-import support unverified; `hall-open` Step 5 active injection already covers both modes |
| 6 | Org picker constraint | Verified against `hall-of-automata` repo existence | Only orgs with Hall installed are valid targets; 404 → halt with clear error |

---

## Action Points

### A1 — `hall-open`: standalone detection + project picker

Add standalone detection and project picker to `hall-open`. When invoked outside a git repo (no `origin` remote), enumerate the user's GitHub orgs, verify `hall-of-automata` is installed, list repos, and present `AskUserQuestion` picker. In-repo path becomes a guard clause — no change to existing flow.

**`invoker-gate.md`:** in standalone mode, derive `$ORG` from `~/.hall/.config.json` (set in Step 1) instead of parsing `git remote`.

**Step 4 (standalone only):** if `CONTEXT_EXISTS=false`, fetch target repo's `CLAUDE.md` via GitHub MCP; write to `~/.hall/context/target-claude.md`; incorporate in `context.md` synthesis. On 404 (repo has no CLAUDE.md): skip silently.

### A2 — Scripts, hooks, tests: global path migration

Migrate all scripts, hooks, and test files from `.hall-cache/` to `~/.hall/`. The only non-mechanical change is `guard-writes.sh`: the existing path normalization (`realpath -m --relative-to=.`) converts absolute `~/.hall/` paths to relative `../../.hall/...` paths, breaking a naive constant replace. Fix: add an absolute-path check before normalization.

`hall-open-setup.py` also loses: the CLAUDE.md injection block (lines 28–39); the gitignore management block; the `.mcp.json` / settings.json / git hook installs in standalone mode (guarded by git remote check). Gains: a migration strip — if CLAUDE.md contains the old `@.hall-cache/session/CLAUDE-stack.md` import line, remove it.

### A3 — Skill files + methodology: path substitution

Replace every `.hall-cache/` occurrence with `~/.hall/` in code blocks across 11 skill files and 4 methodology files. No preamble, no variable — direct constant substitution. Also remove the gitignore management lines from `skills/hall-open/SKILL.md` Step 1 (no longer applicable with a global cache outside any repo).

### A4 — `hall-close` + `hall-prune`: cleanup update

`hall-close`: update Steps 1–3 to use `~/.hall/` paths. Step 1 (CLAUDE.md cleanup) kept for migration: strip old import line if present. Remove gitignore reference.

`hall-prune`: repoint all three operations to `~/.hall/` — `--invoker` clears `~/.hall/invoker.json`; `--plans` prunes `~/.hall/plans/`; `--cache` clears `~/.hall/personas/`. Logic unchanged.

---

## Implementation Plan

All targets in `hall-of-automata-cli` (in-domain). Dispatch to Snowball.

| PR | Title | Action points | Status |
|----|-------|---------------|--------|
| [#136](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/136) | `hall-open`: standalone detection + project picker | A1 | ✅ MERGED |
| [#138](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/138) | Scripts, hooks, tests: global path migration | A2 | ✅ MERGED |
| [#141](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/141) | Skill files + methodology: path substitution | A3 |✅ MERGED |
| [#142](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/142) | `hall-close` + `hall-prune`: cleanup update | A4 | ✅ MERGED |
| [#144](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/144) | Documentation reconciliation | — | ✅ MERGED |

PR 3 and PR 4 were dispatched in parallel after PR 2 merged. Both merged. Documentation PR dispatched after both merged.

**Open follow-up:** [#143](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/143) — Python `open('~/.hall/...')` calls in bash `-c "..."` strings silently fail because `~` is not expanded inside double-quoted bash strings. Hot paths have `2>/dev/null` fallbacks so sessions degrade gracefully. Fix: replace with `os.path.expanduser('~/.hall/...')`. Assigned to Snowball.

---

### PR 1 — `hall-open`: standalone detection + project picker ✅
**Action points:** A1 | **Issue:** [#135](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/135) | **PR:** [#136](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/136) — MERGED

| File | Change |
|------|--------|
| `skills/hall-open/SKILL.md` | Step 1: add `git remote` check; if standalone, org resolution flow (enumerate → pick if multiple → verify → list repos → picker); write `target_repo` to config. Step 4: fetch target repo `CLAUDE.md` in standalone mode. |
| `skills/hall-open/invoker-gate.md` | Read `$ORG` from `~/.hall/.config.json` when standalone instead of parsing `git remote` |

**Tests:** existing `tests/hooks/test-session-start.sh` covers no regression on in-repo open. Manual verification: open from a non-repo directory, confirm picker appears and session initialises.

---

### PR 2 — Scripts, hooks, tests: global path migration ✅
**Action points:** A2 | **Issue:** [#137](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/137) | **PR:** [#138](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/138) — MERGED | **Depends on:** PR 1 merged

| File | Change |
|------|--------|
| `scripts/hall-open-setup.py` | `root = os.path.expanduser('~/.hall')`; replace 14 `.hall-cache` literals; remove CLAUDE.md injection block (lines 28–39); add migration strip; guard `.mcp.json` + settings + git hook installs with standalone detection |
| `scripts/verify-personas.py` | Replace 8 `.hall-cache/` literals |
| `scripts/format-board-context.py` | Replace 2 `.hall-cache/` literals |
| `hooks/scripts/guard-writes.sh` | Add absolute-path check before normalization: `FILE_REAL=$(realpath -m "$FILE_PATH"); HALL_REAL=$(realpath -m "$HOME/.hall"); [[ "$FILE_REAL" == "$HALL_REAL/"* ]] && exit 0`. Keep `.hall-cache/*` fallback during migration. Update blocked message. |
| `hooks/scripts/watcher.sh` | Replace `CACHE=".hall-cache"` (line 13) and `CACHE = '.hall-cache'` (Python inline, line 24) with `~/.hall` |
| `hooks/scripts/session-start.sh` | Update stack path constant; remove gitignore check (lines 9–11) |
| `hooks/scripts/skill-guard.sh` | Update `OPEN_MODE_FILE` path constant (line 4) |
| `hooks/hooks.json` | Update watcher kill command path |
| `tests/hooks/test-guard-writes.sh` | Replace 9 `.hall-cache` references; add test case for absolute `~/.hall/` path being allowed |
| `tests/hooks/test-watcher.sh` | Replace 9 `.hall-cache` references |
| `tests/hooks/test-session-start.sh` | Replace 7 `.hall-cache` references |
| `tests/hooks/test-skill-guard.sh` | Replace 2 `.hall-cache` references |
| `tests/validate-plugin.sh` | Remove gitignore check (line 77) |

**Tests:** run full `bash tests/validate-plugin.sh` and all four hook test suites. Verify `guard-writes.sh` allows writes to `~/.hall/` and blocks writes to arbitrary paths.

---

### PR 3 — Skill files + methodology: path substitution ✅
**Action points:** A3 | **Issue:** [#139](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/139) | **PR:** [#141](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/141) — MERGED | **Depends on:** PR 2 merged

**Review note (resolved):** `hall-doctor/SKILL.md` section 5 (`~/.hall/ in .gitignore`) removed in REFINE commit — check was invalid for a global path. See follow-up issue #143 for the remaining Python tilde expansion issue.

| File | Code refs | Prose refs | Notes |
|------|-----------|------------|-------|
| `skills/hall-open/SKILL.md` | 28 | 5 | Also remove gitignore management lines from Step 1 |
| `skills/hall-init-board/SKILL.md` | 31 | 1 | |
| `skills/hall-close/SKILL.md` | 10 | 0 | |
| `skills/hall-reconcile/SKILL.md` | 6 | 4 | |
| `skills/hall-prune/SKILL.md` | 4 | 4 | |
| `skills/hall-dispatch/SKILL.md` | 3 | 3 | |
| `skills/hall-doctor/SKILL.md` | 3 | 2 | |
| `skills/hall-dispatch/LOCAL.md` | 1 | 0 | |
| `skills/hall-review/SKILL.md` | 1 | 2 | |
| `skills/hall-status/SKILL.md` | 1 | 1 | |
| `skills/hall-consultations/SKILL.md` | 1 | 0 | |
| `methodology/old-major-local-overlay.md` | — | 14 | |
| `methodology/consultation-router.md` | — | 3 | |
| `methodology/decomposition.md` | — | 1 | |
| `methodology/review-loop.md` | — | 1 | |

**Tests:** `bash tests/validate-plugin.sh`. No new test cases — substitution only.

---

### PR 4 — `hall-close` + `hall-prune`: cleanup update ✅
**Action points:** A4 | **Issue:** [#140](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/140) | **PR:** [#142](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/142) — MERGED | **Depends on:** PR 2 merged

| File | Change |
|------|--------|
| `skills/hall-close/SKILL.md` | Steps 1–3: update all paths to `~/.hall/`; Step 1 keeps CLAUDE.md migration strip for old import line; remove gitignore reference |
| `skills/hall-prune/SKILL.md` | `--invoker`, `--plans`, `--cache`: repoint to `~/.hall/` equivalents |

**Tests:** no new test cases. Verify `hall-close` leaves no orphaned session files at `~/.hall/session/`.
