# TODO

Tracked implementation backlog for `hall-of-automata-cli`.

## Todo

- [ ] **P1 — Expose one host-side Crew launcher**

  Keep `start_crew` as durable queue preparation. Expose one Fabric host operation
  that accepts only a queued run/config reference, atomically claims it, and uses
  the existing `agents.create → persist Lead → agents.ask` launch transaction.
  It must be idempotent and return existing run state on replay.

  **Do not add:** a second queue, extension-side agent dispatch, daemon, lifecycle
  supervisor, scheduler, or duplicate state store. The Crew extension continues to
  own roster, Discussion, monitor, and lifecycle state; Fabric remains the only
  actor-dispatch authority.

  **Done when**
  - host callers can prepare and launch a Crew through one supported boundary;
  - a replay never creates a second Lead;
  - launch failure retains durable diagnostics and performs current bounded cleanup;
  - `start_crew` documentation/result names its queue-only behavior accurately; and
  - focused tests cover the host operation rather than only generated launch text.

## Done

- [x] **P0 — Enforce Crew authority and reconcile human-gated closure**
  GitHub: [#416](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/416) · Project 8: Done / Item / P0

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
