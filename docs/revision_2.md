# Hall CLI — Standalone Mode Revision 2

**Date:** 2026-06-04
**Status:** COMPLETE — all PRs merged, documentation reconciliation done

---

## Problem Statement

Hall CLI assumed it was always installed in a repository that had a GitHub remote pointing to the Hall's org. Two failure modes:

1. **Standalone invocation** — user runs `cc` outside a git repo (or in a repo with no remote). Hall CLI either crashed or silently fell back without telling the user.
2. **Global path coupling** — all session state lived in `.hall-cache/` at the repository root: gitignored, per-repo, ephemeral. This coupled session identity to the working directory and broke any flow that moved between repos or opened a session before cloning.

The revision migrates session state to a global location (`~/.hall/`), introduces explicit standalone detection, and adds a project picker for standalone sessions.

---

## Audit Findings & Resolutions

| # | Finding | Resolution | Status |
|---|---------|------------|--------|
| 1 | No detection of standalone mode; skill silently fails or crashes when `git remote get-url origin` is empty | **Detect standalone at Step 1; branch to `standalone-flow.md` for org/repo resolution** | ✅ PR #136 |
| 2 | All session state in `.hall-cache/` (repo-local, gitignored) — breaks cross-repo workflows and leaves state orphaned on clone | **Migrate all paths to `~/.hall/` (global, home-directory-relative)** | ✅ PR #138 |
| 3 | Skill and methodology files hard-code `.hall-cache/` path strings | **Global path substitution across all skill and methodology files** | ✅ PR #141 |
| 4 | `hall-close` and `hall-prune` still reference `.hall-cache/` in cleanup logic | **Update cleanup paths to `~/.hall/`** | ✅ PR #142 |
| 5 | `docs/design.md`, `README.md` still describe `.hall-cache/` as session cache root | **Documentation reconciliation pass** | ✅ PR #145 |

---

## Implementation Plan

All targets are in `hall-of-automata-cli`. Each PR is independently mergeable.

| PR | Title | Findings | Status |
|----|-------|----------|--------|
| [#136](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/136) | `hall-open`: standalone detection, project picker, session-setup extraction | 1 | ✅ MERGED |
| [#138](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/138) | Scripts, hooks, tests: global path migration | 2 | ✅ MERGED |
| [#141](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/141) | Skill files + methodology: path substitution | 3 | ✅ MERGED |
| [#142](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/142) | `hall-close` + `hall-prune`: cleanup update | 4 | ✅ MERGED |
| [#145](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/145) | Documentation reconciliation | 5 | ✅ MERGED |

---

## Open Follow-Up

**Issue #143** — Python `open('~/.hall/...')` calls in bash `-c "..."` strings fail because the shell does not expand `~` inside single quotes passed to Python's `open()`. Tilde expansion must be done explicitly with `os.path.expanduser()` or via bash substitution before the Python call. This is a post-merge correctness item; no workaround exists in the current codebase without addressing it. Tracked separately — do not close this revision pending #143.
