---
name: hall-okr
description: OKR formalization flow. Old Major reads this when an invoker describes new initiative work. Not user-invoked — triggered implicitly by work intake.
---

# OKR Formalization Flow

A conversation with up to 6 phases. Work through each phase in order. Do not propose structure until Phase 3.

---

## Phase 0 — Saga intake *(skip if no saga link provided)*

If a saga wiki link is provided:

1. Fetch the saga page via `gh api` or Fetch
2. Extract: **cycle type**, **success horizon**, **verification criteria**
3. Map each verification criterion to a candidate KR — criterion = measurable outcome = KR

Present the mapping before proceeding:

| Verification criterion | Candidate KR |
|------------------------|-------------|
| `<criterion text>` | `[KR N.M]` outcome statement |

If a criterion cannot be outcome-framed, flag it — do not silently drop it.

Wait for invoker confirmation, then proceed to Phase 1.

If no saga link is provided: skip this phase and begin at Phase 1.

---

## Phase 1 — Listen

Receive the invoker's raw idea without shaping it. Do not ask how they want to structure it or what OKR hierarchy they have in mind.

Identify work class:
- **feature** — new user-facing behaviour
- **capability** — new internal or platform capability
- **initiative** — multi-KR effort spanning several specialists or weeks
- **infrastructure** — foundational change (CI, tooling, schema, auth)

Work class is not a label — it shapes how many KRs to expect and whether sequencing constraints exist.

---

## Phase 2 — Sharpen

Ask up to 3 questions. Questions must be about **observable outcomes**, not implementation approach.

Good: *"What does a session look like after this is working — what can an invoker do that they can't do today?"*
Bad: *"Should we implement this as a hook or a skill?"*

Stop asking when the Objective can be stated as a single outcome-framed sentence. If it can be stated clearly from the initial description, skip to Phase 3.

When entering from Phase 0: the saga's success horizon is the Objective seed. Sharpen only what the saga left ambiguous.

---

## Phase 3 — Propose

Draft the structure and present it before filing anything.

**Objective:** one sentence, outcome-framed. Names the observable state of the world when done — not the work to get there.
- Correct: *"X works reliably under Y conditions"*
- Wrong: *"Implement X"* / *"Add support for X"*

**KR table:**

| KR | Metric |
|----|--------|
| `[KR N.M]` outcome statement | how you know it's true |

Every row needs a metric. "Works" is not a metric. "Zero X errors across a complete session" is.

If any KR cannot start until another KR or upstream issue lands, name the blocking dependency explicitly in the KR body — not in a note.

Wait for invoker confirmation or revision requests before proceeding to Phase 4.

---

## Phase 4 — Gate

Run before filing. All 4 must pass:

- [ ] Objective is outcome-framed (not action-framed)
- [ ] Every KR has a measurable metric ("works" is not a metric)
- [ ] Blocking dependencies are named explicitly in KR bodies where they exist
- [ ] Hierarchy is clean: KRs under OKR, Items under KRs, nothing under Items

If any fail: revise with the invoker and re-run. Do not file until all 4 pass.

---

## Phase 5 — File + Wire

Once the gate passes:

1. Create the OKR issue — title `[OKR N] <objective>`
2. Create KR issues — titles `[KR N.M] <outcome>`
3. Wire KRs as sub-issues of the OKR via `sub_issue_write`
4. For each KR: read `skills/hall-decompose/SKILL.md` and apply the atomicity test. File Items and wire them as sub-issues of their KR.
5. If entering from Phase 0: read the current saga wiki page, update the Plan table row(s) with live issue links, and push the edit. Plan table columns: OKR (linked) | Verification criteria. Closed OKRs marked ✓.

**plan.json coupling:** After filing each Item, write `github_issue: <N>` to the corresponding task entry in plan.json. This field is the dispatch pre-check signal: when hall-dispatch encounters a task with `github_issue` set, it applies the `hall:` label to the existing issue rather than creating a new one. The field must be written before the session closes; if it is absent on next dispatch, a duplicate issue will be created.

6. Report: issue numbers, board item IDs, blocked KRs

---

## What OKRs are for

A sync mechanism between the invoker and the specialist pool — a structured contract for what agents are building toward. Not a performance tool. If they feel like overhead, the structure is wrong: cut the KR without a measurable outcome and rewrite it.
