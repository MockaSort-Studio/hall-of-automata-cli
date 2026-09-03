# TODO

Tracked implementation backlog for `hall-of-automata-cli`.

## Todo

- [ ] **P0 — Enforce Crew authority and reconcile human-gated closure**  
  GitHub: [#416](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/416) · Project 8: Todo / Item / P0

  Tool-enforce Lead-only roster mutation, lifecycle, and broadcasts while preserving
  specialist `crew_ask`, `crew_tell`, `crew_post`, and root-thread `crew_reply`.
  Reconcile a rostered specialist that is already absent from Fabric as an audited
  absence; a live actor still requires verified `{ removed: true }` before removal
  from the roster. Require GitHub-confirmed human closure and complete
  `closing → closed` with no actors or stale roster members so the Crew TUI clears.

  **Done when**
  - unauthorized roster, lifecycle, and broadcast operations are rejected;
  - human-gated terminal closure requires GitHub confirmation;
  - absent-actor reconciliation is recorded and removes the stale roster member;
  - live actors still require verified removal;
  - cleanup failures are durable and actionable; and
  - focused behavioral tests cover authority, reconciliation, closure, and TUI state.

  **Evidence:** [Final smoke assessment #415](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/415)
