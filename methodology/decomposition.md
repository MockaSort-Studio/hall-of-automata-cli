# Project Decomposition Methodology

To decompose a project into Hall-dispatchable tasks, follow this procedure in order.

## Phase 1: Clarifying questions

Before proposing any decomposition, identify ambiguities that would force you to make assumptions that could invalidate task design. Ask only about ambiguities that actually affect how work gets structured — not completeness for its own sake.

Categories to probe:
- **Scope edges:** What explicitly is and isn't included in this iteration?
- **Integration points:** Which existing systems does this touch? Are there schemas, APIs, or auth models to conform to?
- **Success criteria:** How will a Hall specialist know their task is done?
- **Constraints:** Tech stack requirements, performance targets, compliance requirements that narrow specialist choice.
- **Ordering assumptions:** Are there implicit dependencies the user hasn't stated (e.g., "the API needs to exist before the frontend")?

Keep the questions focused. Two to four is usually right; ten is never right.

## Phase 2: Task sizing

A well-sized Hall task:
- Can be understood from its issue body alone — the specialist doesn't need context beyond what's written
- Produces a single PR with a coherent diff
- Completes within a specialist's nominal turn budget (approximately 20-40 tool calls)
- Has a clear acceptance criterion

Signs a task is too large: the specialist would need to make significant architecture decisions, or the resulting PR would touch many unrelated files. Split it.

Signs a task is too small: it's a single function or config change a specialist would do in passing while completing a related task. Merge it.

### Decompose by file boundary, not by theme

The correct splitting axis is structural, not thematic. Two deliverables that belong to the same feature but touch different files should still be separate tasks — they can be dispatched in parallel and merged independently.

**Decompose when:** the deliverables don't share the same file in a conflicting way and can be independently merged. The concrete benefits are (1) narrower issue context per specialist, which directly reduces hallucination surface, and (2) a botched sub-task doesn't block a working one.

**Keep together when:** the deliverables genuinely cannot merge without each other (one file must land before the other is coherent), or they are so small that two issues add more overhead than they save.

Theme is a tiebreaker at most — never the primary criterion for bundling.

## Phase 3: Cross-invoker check

Before mapping dependencies, check whether any proposed tasks overlap with active work from other invokers.

**When to run:** Only if `.hall-cache/session/board-context.md` is present and contains active items from invokers other than the current session's. If absent, or if all active items belong to the current invoker, skip this phase silently — it is a no-op on solo sessions.

**How to run:** For each proposed task, apply these overlap heuristics against active board items:

- **Same file or directory target** — the task description or issue body names a specific file or directory that another active item also targets
- **Same domain keyword** — shared terms such as `hall:open`, `reconcile`, `MCP`, `board`, or any domain-specific keyword that places both tasks in the same area
- **Explicit dependency** — the proposed task would modify something another invoker is actively building (e.g., a shared schema, a skill file mid-rewrite, a config another agent is currently updating)

**For each detected overlap, record a `CROSS-INVOKER RISK` entry in the plan proposal:**

```
CROSS-INVOKER RISK
- Board item: #<N> — <title>
- Invoker: <name>
- Recommended action: coordinate via post_comment | block until resolved | proceed with explicit note
```

Action guidance:
- `coordinate via post_comment` — timing coordination is sufficient; no structural conflict
- `block until resolved` — a merge conflict or semantic conflict is likely
- `proceed with explicit note` — overlap is cosmetic or in unrelated sections of the same file

If no overlaps are found, continue to Phase 4 without any note.

## Phase 4: Dependency analysis

For each task, identify:
- **Hard dependencies:** Tasks whose output (a merged PR, a posted analysis) this task requires to start
- **Soft ordering preferences:** Tasks where the output of one helps the other but isn't strictly required

Only create hard dependency edges. Soft preferences are notes, not blockers.

Common dependency patterns:
- Schema / data model tasks block all tasks that read or write that schema
- API definition tasks block frontend tasks that consume the API
- CI/CD setup tasks block tasks that assume CI exists
- Research tasks block implementation tasks that depend on the research conclusion

## Phase 5: Specialist assignment

Assign each task to one specialist using `routing-rationale.md`. If a task spans multiple specialist domains, split it further or assign to the specialist whose domain dominates.

Each task has one of three modes: **doing** (implementation work, produces a PR), **advising** (design/analysis consultation, produces a written analysis), or **researching** (information gathering, produces a research report).

Never assign a single issue to multiple specialists (one `hall:<specialist>` label per issue).

## Phase 6: Plan presentation

Present the plan as:
1. A prose summary of the overall approach (2-3 sentences)
2. A task table: task title, specialist, dependencies (by task title), mode
3. A dependency diagram (Mermaid) showing the execution waves
4. The initial ready set (tasks with no dependencies) and estimated dispatch batch

Ask for explicit confirmation before filing anything.
