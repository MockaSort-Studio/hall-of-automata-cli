---
name: hall-saga
description: Guided design-document conversation producing a saga wiki page for a new dev cycle. Triggered when the invoker describes a new cycle with no open saga.
---

# Skill: Hall Saga

A 5-phase guided conversation. Work through each phase in order. Do not write the document until Phase 4 is confirmed by the invoker.

---

## Phase 1 — Cycle framing

Ask the invoker for:

- **Cycle type:** `revision` | `new-feature` | `new-product`
- **Problem statement:** what is broken, missing, or being built — no solution language. Redirect if needed: "What breaks or is missing today, not how you'd fix it?"
- **Who is affected:** named actors and how they experience the problem
- **Success horizon:** outcome-framed — what winning looks like. "Users can do X" is an outcome. "We will build X" is not.

Do not proceed until all four are established.

---

## Phase 2 — Scope contract

- **In scope:** what this cycle covers, as concrete capabilities
- **Out of scope:** adjacent work explicitly excluded — naming this prevents scope creep
- **Dependencies:** upstream issues, external systems, or predecessor items
- **Risks:** known unknowns with likely impact named

If the invoker cannot name anything out of scope, pause. A cycle with no explicit exclusions has undefined scope.

---

## Phase 3 — Design

Do not propose an approach until Phase 2 is confirmed.

**Use cases** — one per named actor + action pair:
- Actor: named role, not "the user"
- Action: concrete and observable
- Success criterion: measurable — not "it works"

**System design:**
- Proposed approach and the tradeoffs it makes
- Alternatives rejected and why
- Mermaid fenced code block for any flow that is hard to follow in prose

**Open points** — genuine blockers or unresolved decisions only. If a point is resolvable by reading a file or making a technical judgment, resolve it and state the rationale.

---

## Phase 4 — Verification criteria

Derived from Phase 3. These are system-level correctness proofs — not copies of use-case success criteria.

Each criterion must be named, measurable, and explicit about how it is proven. These feed into `skills/hall-okr/SKILL.md` for KR derivation. If a criterion cannot be proven, the design is incomplete.

---

## Phase 5 — Post to wiki

Compose the saga once Phases 1–4 are confirmed. Post to the target repository's GitHub Wiki.

**Title:** `Saga — <cycle-type>: <one-line description> (<YYYY-MM>)`

**Saga template:**

```
# Saga — <cycle-type>: <description> (<YYYY-MM>)

**Cycle type:** revision | new-feature | new-product

## Problem
<problem statement — no solution language>

**Affected:** <named actors and how they experience it>
**Success horizon:** <outcome-framed statement of what winning looks like>

## Scope

**In scope:** <list>
**Out of scope:** <list>
**Dependencies:** <list or "none">
**Risks:** <list or "none">

## Use cases

| Actor | Action | Success criterion |
|-------|--------|-------------------|
|       |        |                   |

## System design

<approach and tradeoffs>

<Mermaid diagram(s) where the flow is hard to follow in prose>

<Open points inline, adjacent to the decisions they affect>

## Verification criteria

| # | Criterion | How to prove |
|---|-----------|-------------- |
| 1 |           |              |

## Open points

| # | Open point | Impact | Resolution path |
|---|------------|--------|-----------------|
```

**Posting:**

```bash
git clone "https://github.com/{owner}/{repo}.wiki.git" /tmp/wiki
# write the saga file, then:
git -C /tmp/wiki add . && git -C /tmp/wiki commit -m "Add saga: <description>" && git -C /tmp/wiki push
```

**Create Bug-Fixes subpage:** Immediately after pushing the main page, create a subpage at `<Saga-slug>/Bug-Fixes` (e.g. `Saga-0-The-Iron-Muster/Bug-Fixes`):

- **Header:** `# Bug Fixes — <Saga title>`
- **Body:** `_Bug fixes filed against this saga. One section per fix._`
- Append a `## See also` section to the main saga page:
  ```
  ## See also
  - [[<Saga-slug>/Bug-Fixes|Bug Fixes]]
  ```

Commit both together:

```bash
mkdir -p /tmp/wiki/<Saga-slug>
# write <Saga-slug>/Bug-Fixes.md, update main page with ## See also, then:
git -C /tmp/wiki add . && git -C /tmp/wiki commit -m "Add Bug-Fixes subpage: <Saga title>" && git -C /tmp/wiki push
```

Subpage entry format — for reference; automata write entries when closing items, not this skill:

```
## Bug: <issue title>
<One paragraph: what broke, what was fixed, what changed.>
Issue: #<N> · PR: #<M>
```

Return both the main wiki page URL and the Bug-Fixes subpage URL. Include both in the saga dispatch context.

If the wiki is not enabled for the target repository, name the blocker and ask the invoker to enable it before proceeding.
