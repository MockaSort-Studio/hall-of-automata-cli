# Hall CLI — Consolidation Revision 1

**Date:** 2026-05-21  
**Status:** COMPLETE — all PRs merged, post-revision consistency pass done

---

## Problem Statement

Stacking features and skills improved Hall CLI's capabilities but introduced bloating and AI slop. Time to consolidate using a top-down approach, starting from the feature tree below.

**Core assumption:** Hall CLI is always used in session mode. Skills and commands are for Old Major and admin use — not direct user invocation. Hall sessions must be idempotent and coherent with configuration.

### Core Features

- Design and pair programming partner
- Brainstorm designs
- Decompose into plans tracking dependencies, risks, and specialist routing
- Execute plans unattended; ask for review and permission before execution

### Normal Mode
_Prerequisites: hall-of-automata installed in org, invoker team membership._

- Dispatch automata via the Hall
- Unattended work: optional auto-review and auto-merge of PRs (inline, not subagent)
- Full OKR/Projects board integration
- Three-tier advisory

**Critical:** When Hall session is open, Old Major has max priority — no concurrent skills from other plugins may interfere. Old Major enforces code quality on every issued task.

### Local Mode
Fallback when Normal Mode prerequisites are missing. All capabilities run inline. Old Major implements directly using its own engineering judgment — no specialist framing, no subagent layer. Answers the question: "what would the specialist do?"

---

## Audit Findings & Resolutions

| # | Finding | Resolution | Status |
|---|---------|------------|--------|
| 1 | `hall-dispatch/SKILL.md` does too much — review loop (Step 0) and dispatch loop (Steps 2–7) in one file; reads like a script, not a skill | **A1: Split into `hall-dispatch` + `hall-review`** | ✅ PR #116 |
| 2 | `hall-reconcile/SKILL.md` "Full state reference" table duplicates `plan.json.schema` | **A2: Delete it** | ✅ PR #114 |
| 3 | Local mode overlay claims Old Major reads specialist personas and applies their methodology — it doesn't | **A3: Strip specialist framing from overlay** | ✅ PR #114 |
| 4 | Tier-2 advisory subagent uses broken frontmatter (`model:`, `tools:`) same as the reviewer overlay we fixed in PR #106 — would fail if spawned | **A4: Fix subagent-overlay.md.tpl + consultation-router** | ✅ PR #113 |
| 5 | Doing-mode subagent question — is there a missing middle ground? | **No action.** Doing-mode stays dispatch-based. Inline review (PR #106) is correct. Local mode is Old Major inline. No subagent layer needed. | ✅ No action |
| 6 | `hall-open` CLAUDE.md append is not fully idempotent — edge cases can produce duplicate imports or wrong position | **A5: Read-strip-rewrite** | ✅ PR #115 |
| 7 | CLAUDE-stack loads 5 methodology files unconditionally; 3 of them are Old Major-only and inflate session context every time | **A6: Remove 3 files from stack @-imports, reference on-demand** | ✅ PR #118 |
| 8 | `hall-open` doesn't restart autonomous cron on resume — plan advancement silently stalls after close+reopen | **A7: Restart cron in hall-open Step 3 when tasks are DISPATCHED/IN_PROGRESS** | ✅ PR #115 |
| 9 | `reviewer-overlay.md.tpl` and `subagent-overlay.md.tpl` contain @-imports that don't resolve when loaded via Read — reviewer has no persona context | **A8: Replace @-imports with explicit Read instructions in both overlay templates** | ✅ PR #113 |
| 10 | `consultation-router.md` Tier 2 passes unresolved @-import text as Agent context — subagent gets no persona, no base | **A9: consultation-router Tier 2 must Read and inline automaton_base.md + persona before spawning** | ✅ PR #113 |
| 11 | `hall-close` doesn't delete `.open_mode` — skill guard remains active indefinitely after session close | **A10: Add `rm -f .hall-cache/session/.open_mode` to hall-close Step 3** | ✅ PR #114 |
| 12 | `hall-open --refresh` mid-session regenerates the stack but doesn't reload it — persona changes silent until next session | **A11: Document limitation; add force-read on --refresh** | ✅ PR #115 |
| 13 | Watcher PID reuse: `kill -0` passes for unrelated processes that inherit the PID | **A12: Verify watcher by command name, not just PID** | ✅ PR #115 |
| 14 | `board-context.md` flat-table fallback hardcodes `Invoker`/`Epic` — stale after field redesign in PR #95 | **A13: Update fallback to use `Owner`/`Priority`/`Reference`** | ✅ PR #114 |

---

## Action Points

### A1 — Split `hall-dispatch` + `hall-review`
Extract Step 0 (review loop) from `skills/hall-dispatch/SKILL.md` into a new `skills/hall-review/SKILL.md`. `hall-dispatch` calls it at Step 0; cron calls it directly. Each file ends up under 100 lines. Cron prompt simplifies to `/hall:review` instead of "dispatch, Step 0 only". Old Major gains a clean `/hall:review` command for manual review runs.

### A2 — Remove dead section from `hall-reconcile/SKILL.md`
Delete the "Full state reference" table at the bottom (~12 lines). Authoritative state reference is `plan.json.schema`.

### A3 — Strip specialist framing from local mode overlay
In `old-major-local-overlay.md` Local Mode section: remove all text about reading specialist personas and applying their domain methodology. Keep branch convention (`local/<task-slug>`) and result artifact (`local-runs/<task-id>/result.md`). One honest sentence replaces it: Old Major implements inline using its own engineering judgment.

### A4 — Fix tier-2 advisory subagent spawn
In `templates/subagent-overlay.md.tpl`: strip the broken frontmatter (`---\ndescription:\nmodel:\ntools:\n---`). In `methodology/consultation-router.md`: update tier-2 spawn to use the inline-Read approach — Read the overlay, apply methodology inline — same fix as PR #106 for reviewers. Three-tier structure is preserved; only the spawn mechanism changes.

### A5 — Fix `hall-open` CLAUDE.md idempotency
In `skills/hall-open/SKILL.md` Step 3: replace the append-if-missing pattern with read-strip-rewrite:
```python
content = IL + '\n' + content.replace(IL, '').lstrip('\n')
```
Guarantees exactly one occurrence of the stack import, always as the first line, regardless of prior state.

### A6 — Reduce CLAUDE-stack always-loaded context
In `templates/CLAUDE-stack.md.tpl`: remove `@-imports` for `decomposition.md`, `consultation-router.md`, `routing-rationale.md`. In `old-major-local-overlay.md`: add explicit references — Old Major reads them via Read tool when needed. `review-loop.md` stays in the stack (reviewer overlays load it directly).

### A7 — Restart cron on resume when tasks are in-flight
In `skills/hall-open/SKILL.md` Step 3: after assembling the stack, check all active plan `plan.json` files for tasks with status `DISPATCHED` or `IN_PROGRESS`. If any are found and `.hall-cache/session/cron.json` is absent, recreate the cron (same schedule and prompt as `hall-dispatch` Step 7). Write the new cron ID to `cron.json`. This makes resumed sessions behaviorally identical to freshly-opened ones.

### A8 — Replace @-imports in overlay templates with explicit Read instructions
In `templates/reviewer-overlay.md.tpl`: replace the three @-import lines (`automaton_base.md`, persona file, `review-loop.md`) with explicit instructions at the top of the body:
> "Before beginning: Read `.hall-cache/personas/automaton_base.md`, Read `{{PERSONA_PATH}}`, Read `.hall-cache/methodology/review-loop.md`."

In `templates/subagent-overlay.md.tpl`: same replacement for `automaton_base.md` and persona file. This ensures context loads correctly when the overlay is loaded via Read, not @-import.

### A9 — Fix tier-2 consultation-router to resolve persona content
In `methodology/consultation-router.md` Tier 2 path: before spawning (or answering inline), explicitly Read `automaton_base.md` and the specialist persona file. Construct the context description inline in the Agent prompt using that content, rather than passing the overlay file path and trusting @-imports to resolve. The three-tier structure is preserved; only the context assembly changes.

### A10 — Fix hall-close: delete `.open_mode` on session close
In `skills/hall-close/SKILL.md` Step 3: add `rm -f .hall-cache/session/.open_mode` alongside the existing cleanup. `skill-guard.sh` uses this file as its "session active" signal — leaving it behind means the skill guard blocks non-Hall skills after the session ends.

### A11 — Document stack reload limitation; add --refresh force-read
In `skills/hall-open/SKILL.md` Step 2: add a note — stack changes regenerated mid-session don't take effect in the current context window; a fresh session is required. Optionally, add a force-read step when `--refresh` is passed that explicitly reads each @-imported file in the new stack and applies them as operating instructions.

### A12 — Watcher: verify by command, not just PID (minor)
In `skills/hall-open/SKILL.md` Step 3 watcher block: replace `kill -0 "$WPID"` with a command-name check:
```bash
ps -p "$WPID" -o comm= 2>/dev/null | grep -q watcher
```
Or write a heartbeat file from `watcher.sh` every 60 seconds and check its age (`find .hall-cache/watcher.heartbeat -mmin -2`). Eliminates the PID-reuse false-positive.

### A13 — Fix board-context flat-table fallback field names (minor)
In `skills/hall-open/SKILL.md` board context block, `else` (legacy) branch: update column headers and field access from `Invoker`/`Epic` to `Owner`/`Reference` to match the fields provisioned by the redesigned `hall-init-board`. If old-format boards are no longer supported, remove the fallback entirely.

### Adoc — Reconcile all documentation
After all action points are merged, do a single documentation pass across every human-readable artifact. Goal: no file describes behavior that no longer exists; no file omits behavior that does exist.

**Primary source — `docs/` folder (most drift, highest priority):**
- `docs/design.md` (643 lines) — significant drift identified:
  - §1 "What it does not do" says "Write code — implementation always runs in a Hall specialist's runner." Local mode contradicts this; section needs a Local Mode note
  - Stack assembly description (§2) needs update for A6 (3 methodology files no longer always-loaded)
  - Review flow needs update for inline review mechanism (no subagent spawn)
  - Tier-2 advisory description needs update for A9 fix (persona now resolved before spawning)
  - Any section describing `hall-dispatch` Step 0 needs update after A1 split
- `docs/testing.md` — known issues:
  - Layer 1 test list outdated: missing `test-skill-guard.sh` (PR 1), `test-hall-open-idempotency.sh` (PR 3), `validate-plugin.sh` new checks (PRs 2, 4, 5)
  - Layer 2 autocomplete check: add `hall:review` after A1
  - §3b close expected output says "`.hall-cache/` removed" — wrong; `hall-close` only removes stack + agents, not the whole cache
  - §3d reconcile says tasks update to `DONE` — wrong terminal state; individual tasks reach `MERGED`, plan-level completion cancels the cron
  - `cat .hall-cache/plan.json` — wrong path; should be `.hall-cache/plans/<plan-slug>/plan.json`
- `docs/releasing.md` — check for stale version references or steps that no longer apply
- `docs/board-spec-queries.md` — check field names against post-PR #95 schema (`Owner` not `Invoker`, no `Epic`)

**Secondary scope:**
- `skills/*/SKILL.md` frontmatter (`description:` field) — verify each description matches post-revision behavior
- `plugin.json` — add `hall-review` entry after A1; verify all existing entries are accurate
- `methodology/*.md` — confirm no @-import lines remain in files meant to be loaded via Read after A8/A9
- `templates/*.md.tpl` — verify template output is accurate and no dead instructions remain
- `skills/hall-reconcile/SKILL.md` stale inline comment on last line — remove
- `README.md` — verify it still accurately describes the plugin, modes, and prerequisites
- Note which `hall-codex` pages need updating (cannot change here; flag for follow-up)

---

## Implementation Plan

All targets are in `hall-of-automata-cli` (in-domain). Old Major implements directly. Each PR is independently mergeable; order within PRs is internal only.

| PR | Title | Action points | Status |
|----|-------|---------------|--------|
| [#114](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/114) | Quick behavioral fixes | A2, A3, A10, A13 | ✅ MERGED |
| [#113](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/113) | Overlay context fix | A4, A8, A9 | ✅ MERGED |
| [#115](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/115) | hall-open improvements | A5, A7, A11, A12 | ✅ MERGED |
| [#118](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/118) | Stack context reduction | A6 | ✅ MERGED |
| [#116](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/116) | Dispatch/review split | A1 | ✅ MERGED |
| [#120](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/120) | Documentation reconciliation | Adoc | ✅ MERGED |

**Post-revision consistency pass (inline, no PR):** 6 additional gaps found in deep analysis after all PRs merged — stale `/hall:dispatch Step 0` references across 4 files, `DONE` vs `MERGED` status bug in `hall-review/SKILL.md`, wrong cron prompt on resume in `hall-open/SKILL.md`. All fixed on master (commits `99f2c93`, `e6bb9a7`).

**hall-open split (inline, no PR):** `skills/hall-open/SKILL.md` was 369 lines — extracted 3 Python helpers to `scripts/` and invoker detection to `skills/hall-open/invoker-gate.md`. File reduced to 192 lines. Commit `55fc7ba`.

---

### PR 1 — Quick behavioral fixes ✅
**Action points:** A2, A3, A10, A13 | **PR:** [#114](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/114)

| File | Change |
|------|--------|
| `skills/hall-reconcile/SKILL.md` | Delete "Full state reference" table (lines 179–196) |
| `methodology/old-major-local-overlay.md` | Remove lines 172-177 (read specialist persona / apply domain methodology); replace with one honest sentence |
| `skills/hall-close/SKILL.md` | Add `rm -f .hall-cache/session/.open_mode` to Step 3 |
| `skills/hall-open/SKILL.md` | Update flat-table fallback: `Invoker` → `Owner`, drop `Epic`, add `Reference` |

**Tests:** New `tests/hooks/test-skill-guard.sh` covering:
- Blocks non-Hall skill when `.open_mode` exists
- Allows `hall-of-automata-cli:*` skills when `.open_mode` exists
- Passes through when `.open_mode` absent
- Passes through when `CLAUDE_TOOL_INPUT` has no `skill` field
- After A10: verify `hall-close` Step 3 leaves no `.open_mode` (bash mock test)

### PR 2 — Overlay context fix ✅
**Action points:** A4, A8, A9 | **PR:** [#113](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/113)

| File | Change |
|------|--------|
| `templates/subagent-overlay.md.tpl` | Strip broken frontmatter (lines 1–5); replace @-import lines with explicit Read instructions |
| `templates/reviewer-overlay.md.tpl` | Replace 3 @-import lines with explicit Read instructions at top of body |
| `methodology/consultation-router.md` | Tier 2 path: before spawning, Read `automaton_base.md` + specialist persona inline; pass resolved content to Agent |

**Tests:** No new test files. Validate via `tests/validate-plugin.sh` — template files are checked for well-formedness. Manual verification that rendered overlays contain no @-import lines: add a check to `validate-plugin.sh` that greps rendered template output for `^@` and fails if found.

### PR 3 — hall-open improvements ✅
**Action points:** A5, A7, A11, A12 | **PR:** [#115](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/115)

All changes in `skills/hall-open/SKILL.md`.

| Location | Change |
|----------|--------|
| Step 3, CLAUDE.md block | Replace append-if-missing with read-strip-rewrite: `content = IL + '\n' + content.replace(IL, '').lstrip('\n')` |
| Step 3, after stack assembly | Add cron-restart block: scan active plan for DISPATCHED/IN_PROGRESS tasks; if found and `cron.json` absent, recreate cron |
| Step 2, near end | Add note about stack reload requiring a fresh session; if `--refresh`, force-read new stack files as operating instructions |
| Step 3, watcher block | Replace `kill -0 "$WPID"` with `ps -p "$WPID" -o comm= 2>/dev/null \| grep -q watcher` |

**Tests:**
- Update `tests/hooks/test-watcher.sh`: add case verifying that a watcher whose PID was reused by a different process is NOT mistaken for a running watcher (requires mock)
- Add CLAUDE.md idempotency test to `tests/hooks/test-session-start.sh` or a new `tests/test-hall-open-idempotency.sh`: run the CLAUDE.md write block twice; verify import appears exactly once at line 1

### PR 4 — Stack context reduction ✅
**Action points:** A6 | **PR:** [#118](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/118)

| File | Change |
|------|--------|
| `templates/CLAUDE-stack.md.tpl` | Remove @-imports for `decomposition.md`, `consultation-router.md`, `routing-rationale.md` |
| `methodology/old-major-local-overlay.md` | Add "read when needed" references for each of the three removed files, with explicit triggers |

**Tests:** Update `tests/validate-plugin.sh`: after A6, verify that `CLAUDE-stack.md.tpl` does NOT @-import the three removed files (grep check).

### PR 5 — Dispatch/review split ✅
**Action points:** A1 | **PR:** [#116](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/116)

| File | Change |
|------|--------|
| `skills/hall-dispatch/SKILL.md` | Extract Step 0 body into `skills/hall-review/SKILL.md`; Step 0 becomes a one-line call to `/hall:review` |
| `skills/hall-review/SKILL.md` | New file: the review loop (currently Step 0 of dispatch), under 100 lines |
| `skills/hall-dispatch/SKILL.md` Step 7 cron prompt | Change `"dispatch, Step 0 only"` to `/hall:review` |
| `plugin.json` | Add `hall-review` skill entry |

**Tests:** Update `tests/validate-plugin.sh`:
- Verify `skills/hall-review/SKILL.md` exists and has valid frontmatter
- Verify `hall-review` is registered in `plugin.json`
- Verify `skills/hall-dispatch/SKILL.md` is under 200 lines post-split

### PR 6 — Documentation reconciliation ✅
**Action point:** Adoc | **PR:** [#120](https://github.com/MockaSort-Studio/hall-of-automata-cli/pull/120)

Single pass after all PRs are merged. No code changes — markdown and plugin.json description fields only. Verify no file describes behavior that no longer exists.

**Tests:** `tests/validate-plugin.sh` already validates plugin structure. After this PR, run the full suite and confirm clean.
