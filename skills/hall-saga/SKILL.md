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

**Filename:** `Saga-N-<Name> [open].md` — the filename is the page title; the `[open]` tag is how agents verify the saga is active. Replace with `[complete]` when the cycle closes.

**Saga template** (no H1 — GitHub Wiki uses the filename as the page title):

```
_Saga type: <cycle-type>. Status: open. Filed: <YYYY-MM-DD>._
_Source issue: <link if available>_

---

## Design Doc

### Problem
<problem statement — no solution language>

**Affected:** <named actors and how they experience it>
**Success horizon:** <outcome-framed statement of what winning looks like>

### Scope

**In scope:** <list>
**Out of scope:** <list>
**Dependencies:** <list or "none">
**Risks:** <list or "none">

### Use cases

| Actor | Action | Success criterion |
|-------|--------|-------------------|
|       |        |                   |

### System design

<approach and tradeoffs>

<Mermaid diagram(s) where the flow is hard to follow in prose>

<Open points inline, adjacent to the decisions they affect>

### Verification criteria

| # | Criterion | How to prove |
|---|-----------|--------------|
| 1 |           |              |

### Open points

| # | Open point | Impact | Resolution path |
|---|------------|--------|-----------------|

---

## Bug Fixes

_No bug fixes filed yet._
```

**Posting:**

```bash
# 1. Ensure wiki is enabled on the target repo (no-op if already on)
gh api repos/{owner}/{repo} --method PATCH -f has_wiki=true

# 2. Clone wiki — falls back to fresh init if wiki was never initialised
TOKEN=$(gh auth token)
WIKI_DIR=$(mktemp -d)
git clone "https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.wiki.git" "$WIKI_DIR" 2>/dev/null \
  || {
    git -C "$WIKI_DIR" init
    git -C "$WIKI_DIR" remote add origin \
      "https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.wiki.git"
  }

# 3. Write the saga file and push
# write "Saga-N-<Name> [open].md" into $WIKI_DIR, then:
git -C "$WIKI_DIR" add .
git -C "$WIKI_DIR" -c user.name="Old Major" -c user.email="old-major@hall" \
  commit -m "saga: open Saga-N-<Name>"
git -C "$WIKI_DIR" push origin master
rm -rf "$WIKI_DIR"
```

Both enabling the wiki and initialising it for the first time are handled silently — do not surface these as blockers or ask the invoker to do anything manually. Return the wiki page URL to the invoker. This URL is the saga reference for dispatch context.
