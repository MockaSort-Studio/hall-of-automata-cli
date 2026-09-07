# TODO

Tracked implementation backlog for `hall-of-automata-cli`.

## Todo

- [ ] **P1 — Expose one host-side Crew launcher**

  Keep `start_crew` as durable queue preparation. Expose one Fabric host operation
  that accepts only a queued run/config reference, atomically claims it, and uses
  the existing `agents.create → persist Lead → agents.ask` launch transaction.

  **Do not add:** a second queue, extension-side agent dispatch, daemon, lifecycle
  supervisor, scheduler, or duplicate state store.

  **Done when:** replay never creates a second Lead; failures retain diagnostics and
  bounded cleanup; and tests exercise the host operation, not generated text alone.

## Done

- [x] **P0 — Harden Crew closure retries and reconciliation**
  Commit: `7b77f96`

  `crew_reconcile_absent` restricted to `closing` state. Human-gated ticks now branch
  by roster state: poll only while `started`, resume cleanup/finalization while
  `closing`. Tests cover live removal, absent reconciliation, and tick branching.

- [x] **P2 — Serialize and recover Crew kickoff**
  Commit: `7b77f96`

  `crew_kickoff` now runs inside the roster mutation queue and persists a
  `kickoffIntent` marker before touching GitHub. An interrupted roster write blocks
  retries until explicit recovery. Tests cover serialization contract and recovery guard.

- [x] **P3 — Settle the caller-identity boundary**
  Commit: `7b77f96`

  Fabric already injects `PI_FABRIC_ACTOR_ID` into actor processes. `assertActorOwnsSender`
  in `caller.mjs` binds `from` to that environment value when present; no-op when
  absent (non-actor host calls). No custom identity service added. Documented via
  focused test in `tests/crew/caller.test.mjs`.

- [x] **P0 — Enforce Crew authority and reconcile human-gated closure**
  GitHub: [#416](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/416) · Project 8: Done / Item / P0

  **Evidence:** [Final smoke assessment #415](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/415)
