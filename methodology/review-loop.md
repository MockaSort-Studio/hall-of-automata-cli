# Review Loop Methodology

The PR review loop governs how a specialist's PR is evaluated and resolved. Three steps: Act → Assess → Settle, with a single optional Refine cycle.

## 1. Loop diagram

```
ACT      Specialist opens PR against issue acceptance criteria
  ↓
ASSESS   Reviewer posts structured verdict
  ├─ LGTM    ─────────────────────────────────────→ SETTLE
  ├─ MINOR   → REFINE (one cycle permitted)
  │                ↓
  │            ASSESS-2  Reviewer posts final verdict — unconditionally terminal
  │              ├─ LGTM ──────────────────────────→ SETTLE
  │              └─ any  ──────────────────────────→ SETTLE (escalate)
  ├─ MAJOR   ─────────────────────────────────────→ SETTLE (escalate)
  └─ BLOCKED ─────────────────────────────────────→ SETTLE (escalate)

REFINE   Specialist addresses MINOR findings — one shot, no further loop
SETTLE   Resolve: merge or escalate, based on verdict and automation level
```

## 2. Verdict taxonomy

| Verdict | Definition | When to use |
|---------|-----------|-------------|
| **LGTM** | PR meets all acceptance criteria; ready to merge | All required criteria satisfied; any remaining findings are purely stylistic |
| **MINOR** | Findings the specialist can address in one pass without architectural rethink | Localized bugs, missing tests, naming, small formatting — no structural change required |
| **MAJOR** | Findings that require architectural judgment or invoker input to resolve | Fundamental design conflict, scope creep that changes the task contract, cross-cutting concern |
| **BLOCKED** | A prerequisite is absent that the specialist cannot supply — PR cannot be completed as-is | Missing dependency PR, unresolved API contract, acceptance criterion that was never defined |

**MINOR vs MAJOR:** the deciding question is whether the specialist can address the finding entirely within their task scope, without invoker input or cross-task coordination. If yes, MINOR. If the finding requires a decision above task level, MAJOR.

**MAJOR vs BLOCKED:** MAJOR means the PR has the wrong design; BLOCKED means it cannot progress at all until something external is resolved.

## 3. Loop prevention rules

1. Only a MINOR verdict at ASSESS enters the REFINE cycle; all other verdicts skip REFINE entirely.
2. MAJOR at ASSESS goes directly to SETTLE — no refinement attempt.
3. BLOCKED at ASSESS goes directly to SETTLE — no refinement attempt.
4. ASSESS-2 is unconditionally terminal: regardless of verdict severity, ASSESS-2 routes to SETTLE and no further REFINE is permitted.
5. A reviewer must never issue a third ASSESS on the same PR.

## 4. Required verdict comment format

All reviewer comments must use this block verbatim:

```
VERDICT: <LGTM | MINOR | MAJOR | BLOCKED>
FINDINGS:
- <finding> [severity: minor | major]
NEXT: <merge | address-and-resubmit | escalate-to-invoker>
```

**Field rules:**
- `VERDICT` — exactly one value; determines routing.
- `FINDINGS` — one bullet per finding with a `[severity: minor | major]` tag; on LGTM write `- none`.
- `NEXT` — must match verdict: LGTM → `merge`; MINOR → `address-and-resubmit`; MAJOR or BLOCKED → `escalate-to-invoker`.

## 5. Automation level behavior at SETTLE

Automation level is set once at `/hall:open` and stored in `.hall-cache/session/config.json`. See §13.1 of `docs/design.md` for how the level is configured.

| Level | Name | At SETTLE with LGTM | At SETTLE with non-LGTM |
|-------|------|---------------------|-------------------------|
| 0 | Hands-on | Flag invoker to review and merge | Flag invoker with verdict and findings |
| 1 | Assisted | Flag invoker to merge | Flag invoker with verdict and findings |
| 2 | Auto-merge | Merge automatically | Flag invoker with verdict and findings |

Automation applies only to the merge action on a clean LGTM. All non-LGTM outcomes at SETTLE require invoker attention regardless of level.

## 6. Task state transitions

```
IN_PROGRESS → REVIEWING  (specialist opens PR; Old Major dispatches review issue at level ≥ 1)
REVIEWING   → MERGED     (SETTLE with LGTM)
REVIEWING   → ESCALATED  (SETTLE with MAJOR, BLOCKED, or ASSESS-2 non-LGTM)
```

State is written to `plan.json` and rendered by `/hall:status`. ESCALATED tasks surface as a distinct row requiring invoker action. MERGED tasks close silently.

At level 0, Old Major does not dispatch a review issue; the specialist PR lands in `REVIEWING` state and stays there until the invoker acts.
