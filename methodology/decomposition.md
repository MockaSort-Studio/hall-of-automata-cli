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

## Phase 3: Dependency analysis

For each task, identify:
- **Hard dependencies:** Tasks whose output (a merged PR, a posted analysis) this task requires to start
- **Soft ordering preferences:** Tasks where the output of one helps the other but isn't strictly required

Only create hard dependency edges. Soft preferences are notes, not blockers.

Common dependency patterns:
- Schema / data model tasks block all tasks that read or write that schema
- API definition tasks block frontend tasks that consume the API
- CI/CD setup tasks block tasks that assume CI exists
- Research tasks block implementation tasks that depend on the research conclusion

## Phase 4: Specialist assignment

Assign each task to one specialist using `routing-rationale.md`. If a task spans multiple specialist domains, split it further or assign to the specialist whose domain dominates.

Never assign a single issue to multiple specialists (one `hall:<specialist>` label per issue).

## Phase 5: Plan presentation

Present the plan as:
1. A prose summary of the overall approach (2-3 sentences)
2. A task table: task title, specialist, dependencies (by task title), mode
3. A dependency diagram (Mermaid) showing the execution waves
4. The initial ready set (tasks with no dependencies) and estimated dispatch batch

Ask for explicit confirmation before filing anything.
