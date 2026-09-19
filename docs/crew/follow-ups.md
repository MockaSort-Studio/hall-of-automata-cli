# Crew Operational Follow-ups

Updated: 2026-09-17. This is the current backlog; the SDK runtime structure is
canonical in [runtime-structure.md](runtime-structure.md).

## Completed — SDK runtime migration

- [x] Replaced Fabric actor/mesh startup and generated follow-up launch code with direct
      `start_crew` → SDK Runtime launch.
- [x] Preassemble the roster in Main; run a one-shot Lead and resident specialists in
      isolated worktrees.
- [x] Move worker ownership to Lifecycle RPC and Crew communication to the separate
      WebSocket Comm controller with run-scoped actor IDs.
- [x] Bound base Crew capabilities to Comm and role-specific native tools; removed the
      Fabric-native visibility manifest path.
- [x] Add roster, protocol, Comm, observability, startup, and relocation smoke coverage.

## Remaining runtime hardening

- [ ] Audit context and persona assembly after the SDK port: make the checked-in
      automaton body and roster the sole Crew persona source, remove the obsolete
      Claude consultation overlay, and test bounded prompt snapshots with the full
      ordinal-suffixed Crew handle.
- [x] Add lifecycle failure-injection and RPC protocol tests.
- [x] Run a concurrent two-Crew cleanup probe; verify no worker, worktree, owner record,
      launcher, or RPC process remains after the idle window.

## Issues found in the RPC Crew validation

- [ ] Parse JSON-encoded Comm payload strings before Discussion rendering, then extract a
      human-readable summary/report; never publish raw JSON.
- [x] Acknowledge RPC-worker deliveries after the associated Pi turn settles; reply context
      remains valid for that delivery until acknowledgement.
- [x] Give internal runtime observers raw envelopes. `CommController.observeRaw()` delivers
      the full envelope; adapter `subscribe()` keeps the narrow human-readable projection.
- [x] Split the controller before adding the ledger seam. Event recording and subscriber
      fan-out live in `comm-envelope-observation.mjs`.
- [ ] Complete RPC-worker observability: system/tool tokens and a bounded content-free
      timeline remain absent. Tool-result sizes, tool errors, compaction events, and bounded
      output metrics are now recorded.
- [ ] Make the Crew TUI monitor operationally useful: show live phase, per-agent state,
      latest Comm delivery/error, queued/inflight counts, Discussion link, and terminal result.
- [ ] Bound and deduplicate external transcript posts. The validated run produced repeated
      reports and multi-kilobyte payloads that are unsuitable as Discussion comments.
- [ ] Mark roster/Discussion lifecycle terminal when a run completes or is cleaned up; the
      current durable record can remain `started` after Runtime cleanup.
- [ ] Enforce worker runtime-path isolation. A validation worker resolved `PI_CREW_ROOT` and
      mutated host `.pi/runtime` roster records; workers must receive explicit owned paths and
      reject host/cross-run state writes.

- [ ] Make dependency waiting/release a deterministic worker state machine; validate
      handles, reject cycles, and define failed-dependency timeout/retry/blocked behavior.
- [ ] Add an end-to-end dependency test covering parallel roots, chained release, directed
      completion recipients, blocked status, and the Lead final report.

## Evidence and performance work

- [ ] Capture a per-actor, content-free timeline for the next representative run, including
      context deltas, response usage, tool result sizes, compactions, errors, and timestamps.
- [ ] Establish an untouched baseline, then run an A/B quality gate before changing prompt
      or context policy.
- [ ] Run three controlled serial-versus-Crew benchmark rounds and publish median/range;
      the current single pilot is not a performance decision.

## Deferred product work

- [ ] Define the Hall CLI state-model port: Project progression, Issue closure, dependency
      management, and associated GitHub adapter contracts.
- [ ] Add explicit `PASS | BLOCKED | FAIL` outcomes and terminalize unattended blocked runs
      without falsely accepting work.
- [x] Implement the optional GitHub Discussion CommAdapter; base worker capabilities
      remain Comm-only.
