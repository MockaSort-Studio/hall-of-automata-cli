# Routing Rationale

When proposing a specialist assignment, record the reasoning explicitly — both in the pre-dispatch conversation and in the issue body. This replaces the audit trail that upstream Old Major would normally produce.

## Specialist roster

The Hall's specialist roster is maintained at [hall-codex — Roster](https://mockasort-studio.github.io/hall-codex/roster/). Do not hardcode specialist names in this methodology — read the roster. Each specialist has a `hall:<name>` label used for dispatch.

At session start, `/hall:open` fetches the advisory specialist personas and caches them. Old Major should reference the cached files to understand each specialist's domain before routing.

## Assignment heuristics

**Language is the primary signal for implementation tasks.** Match the task's primary language/technology to the specialist whose domain covers it. Don't over-think it.

**CI/CD is its own domain regardless of language.** A GitHub Actions workflow for any project goes to the CI/CD specialist.

**For tasks that span domains, assign by the dominant work.** A task that's 80% Python with a small CI change goes to the Python specialist.

**Advisory specialists take advisory or research tasks.** Implementation that touches their domain still goes to an implementation specialist — advisory specialists are for analysis, not implementation.

## Rationale format

In the dispatch confirmation summary, explain each assignment in one sentence:
> "<Specialist>: pure Python service logic, no frontend surface, no infrastructure changes."
> "<Specialist>: entirely a CI pipeline addition, language-agnostic."

In the issue body, include a `## Routing` section:
```markdown
## Routing

Assigned to <Specialist>. Rationale: this task implements <description> with no <out-of-domain surfaces>. Dominant work is <domain>.
```

## What not to include in routing rationale

Don't explain the Hall's mechanics to the specialist (they already know them). Don't include meta-commentary about the routing decision itself. Keep it to why this specialist is right for this work.
