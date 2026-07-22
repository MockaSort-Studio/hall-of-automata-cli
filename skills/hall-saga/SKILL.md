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
- Mermaid fenced code block for any flow that is hard to follow in prose. **Never use ASCII art for diagrams.**

**Open points** — genuine blockers or unresolved decisions only. If a point is resolvable by reading a file or making a technical judgment, resolve it and state the rationale.

---

## Phase 4 — Verification criteria

Derived from Phase 3. These are system-level correctness proofs — not copies of use-case success criteria.

Each criterion must be named, measurable, and explicit about how it is proven. These feed into `skills/hall-okr/SKILL.md` for KR derivation. If a criterion cannot be proven, the design is incomplete.

---

## Phase 5 — Post to wiki

Compose the saga once Phases 1–4 are confirmed.

**Status tags** — the only valid values:

| Tag | In filename | In status field | Meaning |
|-----|-------------|-----------------|----------|
| `open` | `[open]` | `Status: open` | Active — dispatch operates against it |
| `draft` | `[draft]` | `Status: draft` | Being authored, not yet active |
| `closed` | `[closed]` | `Status: closed` | Cycle complete |

Filename convention: `Saga-N-<Name> [<tag>].md`. Use no other tag values. Agents search for `[open]` to locate the active saga.

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

<Mermaid diagram(s) — never ASCII art>

<Open points inline, adjacent to the decisions they affect>

### Verification criteria

| # | Criterion | How to prove |
|---|-----------|---------------|
| 1 |           |               |

### Appendix

_No appendices yet. Add lettered sections (A, B, …) for reference material that supports the design but does not belong in the main doc._

---

## Plan

<!-- OKR-level only. No individual tasks — those belong on the board. Link each OKR to its tracking issue. -->

| # | OKR | Link | Status |
|---|-----|------|--------|
| 1 |     |      | open   |

---

## Bug Fixes

<!-- Flat list. No dated headers. One entry per fix: **Title** — one-sentence description. ([#N](link)) -->

_No bug fixes filed yet._
```

**Posting:**

```bash
TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN:-}"
SAGA_FILE="Saga-N-<Name> [open].md"

# Detect wiki availability; attempt to enable if off — may fail on private free-tier orgs
HAS_WIKI=$(gh api repos/{owner}/{repo} --jq '.has_wiki' 2>/dev/null || echo "false")
if [ "$HAS_WIKI" != "true" ]; then
  HAS_WIKI=$(gh api repos/{owner}/{repo} --method PATCH -f has_wiki=true \
    --jq '.has_wiki' 2>/dev/null || echo "false")
fi

if [ "$HAS_WIKI" = "true" ]; then
  WIKI_DIR=$(mktemp -d)
  git clone "https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.wiki.git" "$WIKI_DIR" 2>/dev/null \
    || { git -C "$WIKI_DIR" init
         git -C "$WIKI_DIR" remote add origin \
           "https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.wiki.git"; }
  # write $SAGA_FILE into $WIKI_DIR, then:
  git -C "$WIKI_DIR" add .
  git -C "$WIKI_DIR" -c user.name="Old Major" -c user.email="old-major@hall" \
    commit -m "saga: open Saga-N-<Name>"
  git -C "$WIKI_DIR" push origin master
  rm -rf "$WIKI_DIR"
else
  # Fall back: commit saga file to docs/saga/ in the target repo
  mkdir -p docs/saga
  # write $SAGA_FILE into docs/saga/, then:
  git add "docs/saga/$SAGA_FILE"
  git -c user.name="Old Major" -c user.email="old-major@hall" \
    commit -m "saga: open Saga-N-<Name>"
  git push
fi
```

**Reading saga pages:** check the wiki first, then `docs/saga/` in the main branch. Both locations use identical filename and tag conventions. Return the saga page URL to the invoker — this is the dispatch context reference.
