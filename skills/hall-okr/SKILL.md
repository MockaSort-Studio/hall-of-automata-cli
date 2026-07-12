---
name: hall-okr
description: OKR authoring discipline. Old Major reads this internally when the work-type gate determines OKRs are required. Not user-invoked.
---

# OKR Authoring Discipline

## When to apply

Work-type gate (in persona) routes here for: revision/refactor, new features, new capabilities, infrastructure initiatives. Skip for bugfixes, investigations, hotfixes — dispatch directly.

## Authoring sequence

### 1. Understand the work

Before proposing any structure, establish:
- What capability or outcome does this add or improve?
- What does success look like concretely?
- Are there known dependencies on upstream work, other invokers, or external systems?

Ask these in conversation. Don't assume the invoker's initial framing is the right OKR — most raw ideas need one round of sharpening before they're ready to structure.

### 2. Structure

**Objective:** one sentence, outcome-framed. Not "implement X" — "X behaves reliably under Y conditions." The objective names what the world looks like when done, not the work to get there.

**KR table:** every row has a key result and a metric. The metric must be observable and specific.

| KR | Metric |
|----|--------|
| <outcome statement> | <how you know it's true> |

"Works" is not a metric. "Zero X errors across a complete session" is.

**Blocking dependencies:** if any KR cannot start until another KR or upstream issue lands, name it explicitly in the KR body. Not in a note — in the body.

### 3. Structure gate — do not file until all pass

- [ ] Objective is one sentence, outcome-framed (not action-framed)
- [ ] Every KR row has a measurable metric
- [ ] No KR body is missing an explicit blocking dep where one exists
- [ ] Hierarchy is clean: KRs under OKRs, Items under KRs, nothing under Items

### 4. File and wire

Once the gate passes:
1. Create the OKR issue — title `[OKR N] <objective>`
2. Create KR issues — titles `[KR N.M] <outcome>`
3. Wire KRs as native sub-issues of the OKR (`sub_issue_write`)
4. Add all to the project board; set ItemType and Priority fields
5. Report what landed — issue numbers, board item IDs, blocked KRs noted

---

## KR → Item decomposition gate

**This gate runs before any dispatch.** KRs are outcome targets, not dispatchable units. Items (sub-issues of a KR) are what get specialist labels and produce PRs. A KR may have one Item or many — the check determines which.

### When to run

Every time a KR enters the ready set. No exceptions — even KRs that appear trivially atomic must pass through this gate. Speed is not a reason to skip it; a KR dispatched directly is a KR whose scope was never challenged.

### Atomicity test

For each ready KR, ask:

1. **Single PR?** Can the full scope land as one coherent diff that merges independently?
2. **Single specialist?** Does all the work fall within one domain?
3. **No architecture decisions deferred?** Could a specialist start without needing to make structural choices that should be resolved first?
4. **Acceptance criteria already clear?** Does the KR body already state what must be true when done, specifically enough that a specialist could verify it without asking?

**If all four hold:** one Item is sufficient. Create it, wire it as a sub-issue of the KR, and dispatch the Item.

**If any fail:** decompose. Each Item should satisfy all four conditions independently. Read `skills/hall-decompose/SKILL.md` for the full decomposition procedure.

### Item format

```
Title: [Item] <what this PR delivers>
Body:
- Scope: <what the specialist builds>
- Acceptance criteria: <2–3 outcome assertions>
- Routing: <specialist> — <one-line rationale>
```

Wire as native sub-issue of the KR. Add to board with ItemType=Item. Do not dispatch the KR — dispatch the Item.

### Before presenting to the invoker

State explicitly for each KR in the ready set:
- Atomicity verdict: atomic (1 Item) or decomposed (N Items)
- If decomposed: list the Items and their split rationale
- Wait for confirmation before filing Items or dispatching

## What OKRs are for

OKRs in this system are a sync mechanism between the invoker and the specialist pool — a structured contract for what agents are building toward. They are not a performance tool or a cadence ritual. If they feel like overhead, the structure is wrong: cut the KR without a measurable outcome and rewrite it.
