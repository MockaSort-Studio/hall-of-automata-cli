---
name: hall-decompose
description: Task decomposition methodology for Hall-dispatchable work. Old Major reads this when planning or breaking down board items before dispatch.
---

# Task Decomposition

## Pre-check: atomic item gate

Before running Phases 1–4, check whether the board item satisfies all four:

- Single PR — the work is one coherent diff that merges independently
- One specialist — the work falls entirely within one domain
- Clear acceptance criteria — the item already states what must be true when done
- No architecture decisions required from the specialist

**If all four hold:** skip to Phase 5. Assign and dispatch. Do not create sub-issues.

**If any fail:** proceed through Phases 1–6.

Sub-issues are only warranted when the item decomposes across multiple specialists, or when sequential dispatches are required.

## Phase 1: Clarifying questions

Ask only what affects how work gets structured. Two to four questions is right; ten is never right.

Probe:
- **Scope edges:** what's explicitly in and out of this iteration?
- **Integration points:** schemas, APIs, auth models to conform to?
- **Success criteria:** how does a specialist know they're done?
- **Constraints:** tech stack, performance targets, compliance requirements?
- **Ordering assumptions:** implicit dependencies not yet stated?

## Phase 2: Task sizing

A well-sized Hall task:
- Understood from its issue body alone
- Produces a single PR with a coherent diff
- Completes within ~20–40 tool calls
- Has a clear acceptance criterion

Too large: specialist would need to make architecture decisions, or the PR touches many unrelated files. Split it.

Too small: a single function or config change a specialist would handle in passing. Merge it.

**Split axis is structural, not thematic.** Two deliverables touching different files should be separate tasks even if they belong to the same feature — dispatch them in parallel.

Keep together when: deliverables genuinely can't merge without each other, or they're so small that two issues add more overhead than they save. Theme is a tiebreaker at most.

## Phase 3: Cross-invoker check

Only run when `board-context.md` shows active items from other invokers. Skip silently on solo sessions.

For each proposed task, check against active board items:
- **Same file or directory target**
- **Same domain keyword** (e.g. `hall:open`, `reconcile`, `MCP`, `board`)
- **Explicit dependency** — proposed task modifies something another invoker is actively building

For each overlap, record a `CROSS-INVOKER RISK` in the plan proposal:

```
CROSS-INVOKER RISK
- Board item: #<N> — <title>
- Invoker: <name>
- Recommended action: coordinate via post_comment | block until resolved | proceed with explicit note
```

## Phase 4: Dependency analysis

For each task identify:
- **Hard dependencies:** tasks whose merged output this task requires to start
- **Soft ordering:** tasks where the other's output helps but isn't strictly required

Create only hard dependency edges. Soft preferences are notes, not blockers.

Common patterns: schema tasks block everything reading that schema; API tasks block frontend consumers; CI tasks block tasks that assume CI exists; research tasks block implementations that depend on their conclusion.

## Phase 5: Specialist assignment

Assign each task to one specialist. Read `skills/hall-route/SKILL.md` for assignment rationale.

Each task has one mode: **doing** (implementation, produces PR), **advising** (analysis, produces written output), **researching** (information gathering, produces report).

One specialist per issue. One `hall:<specialist>` label per issue.

## Issue content standard

| Belongs in issue | Does not belong |
|---|---|
| Scope checklist | DDL or code snippets |
| Structured agent input (schema table, etc.) | Verification commands or scripts |
| 2–3 acceptance criteria (outcome assertions) | Prose explanations |

Acceptance criteria state what must be true — not how to verify it. Scannable in under 10 seconds.

## Phase 6: Plan presentation

1. 2–3 sentence prose summary of the overall approach
2. Task table: title, specialist, dependencies, mode
3. Mermaid dependency diagram showing execution waves
4. Initial ready set and estimated dispatch batch

Ask for explicit confirmation before filing.
