# TODO

Tracked implementation backlog for `hall-of-automata-cli`.

## Todo

- [ ] **P0 — Harden Crew closure retries and reconciliation**

  Restrict `crew_reconcile_absent` to `closing`, retain its audit record, and make
  human-gated ticks branch by roster state: poll only while `started`; resume
  cleanup/finalization while `closing`.

  **Done when:** a closed Discussion with specialists can retry after an interrupted
  cleanup; no tick polls a closed/closing Crew; and tests cover live removal, absent
  reconciliation, and retry to terminal state.

- [ ] **P1 — Expose one host-side Crew launcher**

  Keep `start_crew` as durable queue preparation. Expose one Fabric host operation
  that accepts only a queued run/config reference, atomically claims it, and uses
  the existing `agents.create → persist Lead → agents.ask` launch transaction.

  **Do not add:** a second queue, extension-side agent dispatch, daemon, lifecycle
  supervisor, scheduler, or duplicate state store.

  **Done when:** replay never creates a second Lead; failures retain diagnostics and
  bounded cleanup; and tests exercise the host operation, not generated text alone.

- [ ] **P2 — Serialize and recover Crew kickoff**

  Put `crew_kickoff` behind the existing roster mutation queue and persist an
  idempotency marker around its GitHub create/write boundary.

  **Done when:** concurrent or retried kickoff produces one canonical Discussion,
  and an interrupted roster write has an explicit recoverable outcome.

- [ ] **P3 — Settle the caller-identity boundary**

  Verify whether the supported Pi/Fabric invocation context exposes the actual actor
  identity. Bind `from` to it if available; otherwise document that role tool grants
  and trusted Crew actors are the authority boundary.

  **Do not add:** signatures, tokens, or a custom identity service without a
  supported runtime identity primitive.

  **Done when:** the chosen boundary is documented and has a focused regression or
  capability test.

## Done

- [x] **P0 — Enforce Crew authority and reconcile human-gated closure**
  GitHub: [#416](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/416) · Project 8: Done / Item / P0

  Tool-enforce Lead-only roster mutation, lifecycle, and broadcasts while preserving
  specialist `crew_ask`, `crew_tell`, `crew_post`, and root-thread `crew_reply`.
  Reconcile a rostered specialist that is already absent from Fabric as an audited
  absence; a live actor still requires verified `{ removed: true }` before removal
  from the roster. Require GitHub-confirmed human closure and complete
  `closing → closed` with no actors or stale roster members so the Crew TUI clears.

  **Evidence:** [Final smoke assessment #415](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/415)
