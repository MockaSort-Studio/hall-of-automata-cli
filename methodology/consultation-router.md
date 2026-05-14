# Consultation Router

When Old Major needs specialist depth during a conversation, use this decision tree to choose the tier.

## Decision tree

```
Is the question shallow? (naming, sanity check, "does this feel right")
  └─ YES → Tier 1 (inline). Answer using fetched advisory personas.
  └─ NO ↓

Does the question need sustained iteration (>2 exchanges likely) 
OR must the output be team-visible and durable (future reference, ADR, etc.)
OR does it need tools the prepacked MCPs don't provide (LSPs, deep repo introspection)?
  └─ YES → Tier 3 (Hall issue). File hall:<specialist>.
  └─ NO → Tier 2 (subagent). Spawn with upstream persona + subagent overlay.
```

## Tier 1 — Inline

Answer the question yourself using the loaded advisory personas (fetched from the Hall roster and active in this session).

Triggers: directory structure preferences, technology naming, "is this a reasonable approach", quick API surface sanity checks, "what would the backend specialist say about this pattern".

Cost: just continued conversation.

**Failure mode to avoid:** escalating to Tier 2 for questions you can answer inline. Over-spawning subagents adds context overhead and slows the conversation.

## Tier 2 — Subagent

Spawn a one-shot subagent using the loaded specialist overlay from `.hall-cache/session/claude-agents/<specialist>.md`.

Triggers: substantive design analysis (architecture tradeoffs, data model review, performance analysis) that is private to this conversation and doesn't need to be committed anywhere.

**Iteration cap:** after 2 meaningful exchanges on the same topic with the same specialist, propose escalating to Tier 3. Subagents don't have task memory across invocations; a Hall issue thread handles sustained analysis properly.

After a substantive Tier 2 consultation, propose saving the output. Default: `.hall-cache/plans/<plan>/consultations/`. If the output should become a committed artifact (ADR, design note), accept a user-supplied path.

## Tier 3 — Hall issue

File a `hall:<specialist>` issue.

Always for: implementation work (doing mode). Implementation specialists need their full tooling (LSPs, deep repo access) and are Hall-only.

For advisory work when:
- The analysis must be durable and team-visible
- Sustained iteration is expected
- The specialist needs tools the prepacked MCPs don't cover

For the current specialist roster and their `hall:<label>` values, see [hall-codex — Roster](https://mockasort-studio.github.io/hall-codex/roster/).

## User overrides

The user can always override: "just file that as a research issue" or "what's your gut take" are both valid. Honor the override, note it in the plan if it affects routing rationale.
