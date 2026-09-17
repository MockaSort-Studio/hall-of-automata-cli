# Pi Crew Runtime Structure

Status: canonical for `dev`.

## Supported entrypoints

Pi discovers project-local extensions:

- `.pi/extensions/crew/index.ts` — Crew orchestration.
- `.pi/extensions/runtime/index.ts` — SDK Lifecycle and Comm runtime.
- `.pi/extensions/github/index.ts` — bounded GitHub tools.
- `.pi/extensions/web/index.ts` — bounded web fetch.

`tests/pi/test-extension-load.sh` is the relocation smoke test.

## Launch path

1. Main calls `start_crew`.
2. Crew writes a queued config and roster under `.pi/runtime/crew-launch/`.
3. `start_crew` calls the SDK Runtime directly.
4. Runtime starts Comm, registers every actor, starts Lifecycle, then launches resident specialists and the one-shot Lead.
5. Lead creates the canonical GitHub Discussion, wakes specialists through Comm, and owns review and closure.

There is no generated `fabric_exec` launch code, Fabric actor creation, mesh startup signal, or extension-side supervisor.

## Worker model

- Lead: `lead-old-major`, initially one-shot.
- Specialists: assembled Crew roles, resident SDK workers.
- Lifecycle owns worker process handles, worktrees, inspection, and removal.
- Comm owns per-actor mailbox state, delivery, acknowledgement, requeue, and request/reply correlation.

Assembly combines the checked-in persona, role discipline, safety contract, bounded assignment, and allowed Crew/GitHub tools. Runtime adds only `comm_notify`, `comm_request`, and `comm_reply`.

## State and communication

- Roster JSON is the durable Crew identity and Discussion lifecycle record.
- GitHub Discussion is the durable human-readable evidence record.
- Comm carries lightweight coordination only.
- Controller envelope is flat V1: `v`, `id`, `kind`, `from`, `to`, `payload`, `createdAt`, optional `replyTo`.
- Workers see only `{ from, payload, replyRequired }`.
- Sender identity is the roster handle. SDK workers have no Fabric actor identity dependency.

## Closure

Lead records acceptance and closes the Discussion through Crew tools. Runtime/Main owns SDK worker cleanup. Human-gated scheduling is not yet supported by the SDK Crew path.

## Removed paths

Do not reintroduce:

- Fabric actor creation/removal for Crew execution;
- mesh topics for Crew launch or substantive communication;
- generated launch code or user follow-up injection;
- raw shell as ordinary specialist capability;
- unsupported role capabilities outside their bounded tool grants.

## SDK stabilization status — 2026-09-17

The base Crew runtime is now SDK + Comm only; GitHub Discussion behavior is deferred to a future adapter.

- Actor IDs are run-scoped (`crew-<runId>-...`), preventing concurrent Crew mailbox/worktree collisions.
- Lead startup and specialist first-delivery behavior use explicit `initialTurn` configuration rather than prompt-text detection.
- Lifecycle creates/removes worktrees asynchronously with bounded Git commands and compensating cleanup on failed spawn.
- Lifecycle RPC dispatch awaits controller operations; client pending requests reject on close/error/timeout.
- `Runtime.launchCrew` rolls back already-created workers on a later spawn failure.
- `runtime_cleanup`/`Runtime.stop` remove tracked workers before controller shutdown.

Focused validation: Crew startup, Comm controller/runtime tests, extension-load test, and live Comm request/reply all passed. Remaining hardening is dedicated lifecycle failure-injection/RPC protocol test coverage and a concurrent two-Crew cleanup probe.
