# Crew Operational Follow-ups

Updated: 2026-09-19. This is the current backlog; the SDK runtime structure is
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

## Issues found in the RPC Crew validation — resolved

- [x] Acknowledge RPC-worker deliveries after the associated Pi turn settles; reply context
      remains valid for that delivery until acknowledgement.
- [x] Give internal runtime observers raw envelopes. `CommController.observeRaw()` delivers
      the full envelope; adapter `subscribe()` keeps the narrow human-readable projection.
- [x] Split the controller before adding the ledger seam. Event recording and subscriber
      fan-out live in `comm-envelope-observation.mjs`.
- [x] Enforce worker runtime-path isolation. `runtime-root.mjs` requires an explicit owned
      cwd (no env-based host discovery); `assertOwnedRunId` fails closed on path
      traversal/cross-run runIds; spawned workers no longer receive `PI_CREW_ROOT`.
- [x] Make Main a canonical Comm recipient. `qualify()` never namespace-prefixes `"main"`;
      direct `comm_notify`/`comm_request` to Main works without broadcast duplication.
- [x] Restrict `comm_notify_all`/`comm_notify_many` to the Lead role. Specialists only get
      directed Comm tools (`comm_notify`, `comm_request`, `comm_reply`), gated per role via
      `roles.json`'s `commTools`. This was also the primary cause of the turn-inflation seen
      in early Crew runs (every specialist report fanned out to every peer, each triggering a
      follow-up turn).
- [x] Define one durable Crew lifecycle contract (`lifecycle-state.mjs`): explicit
      `queued/running/attention` states, `PASS|BLOCKED|FAIL` terminal outcomes, validated
      transitions.
- [x] Wire worker completion/failure/removal into that contract (`roster-lifecycle.mjs`) and
      roll the per-member outcomes up into a terminal roster-level status
      (`closed`/`failed`/`cancelled`) once every member is terminal — including when workers
      are stopped one at a time across separate calls, not only in a single batch.
- [x] Wire the live footer into the Crew TUI monitor (`monitor.ts` + `monitor-snapshot.mjs` +
      `monitor-footer.mjs`): automaton counts by lifecycle bucket and total generated-output
      tokens, sourced only from the durable roster/lifecycle/worker-metrics files.
- [x] Fix the monitor widget never disappearing/updating for a disbanded Crew — root cause
      was the roster rollup gap above; the widget already retires correctly once the roster
      reaches a terminal status.
- [x] Report provider token traffic (input/output/cache read/write) as separate labelled
      fields — never summed into one "tokens consumed" figure, which double-counts repeated
      cache-read traffic across turns.
- [x] Record per-turn session-context percent and model-context-window in worker telemetry
      (`worker-metrics.mjs` + `model-window.mjs`), retained after cleanup via
      `LifecycleController`'s pre-removal snapshot.
- [x] Parse JSON-encoded Comm payload strings before projecting a human-readable
      message/summary/report for adapters, instead of publishing raw JSON.
- [x] Fix a live, reproducible Crew-startup collision: dispatching 4 workers, 3 got one
      degenerate zero-usage/zero-tool-call turn and then hung silently forever (confirmed
      via `lsof`: no outbound connection, no retry, no error) while 1 worked normally.
      `CommController.broadcast()` delivered every resident worker's first prompt in the
      same tick, so their first real provider requests raced each other within ~128ms.
      Fixed by scheduling, not retrying: `broadcast()` now spaces recipient delivery out by
      a configurable interval (default 250ms, deterministic registration order), so
      concurrent first-activation can no longer be manufactured by our own fan-out.
- [x] Fix the monitor footer/dashboard showing every active automaton as `queued` for its
      entire run. `monitor-snapshot.mjs`'s `bucketFor()` now derives a `running` bucket from
      live worker-metrics evidence (turns/tool calls > 0) when no explicit lifecycle entry
      is recorded; an explicit terminal/other status still takes precedence, and a zero-
      activity actor correctly remains `queued`. No new roster-write path added.
- [x] Add a bounded, non-looping safety net for a degenerate zero-usage/empty-content
      completed turn. Live evidence showed the collision could recur even after the
      broadcast-stagger fix (0/2, 0/2 across two dispatches with only two staggered
      recipients) -- scheduling alone was insufficient. `worker-comm-extension.mjs` now
      retries the exact same delivery prompt exactly once when a `turn_end` fires with zero
      tokens and zero tool calls (never when no `turn_end` fires at all, e.g. a reply-driven
      completion -- an earlier version of this fix falsely flagged that as degenerate and
      hung waiting for a second `agent_settled` that never came); if the retry is also
      degenerate, reports BLOCKED to Main with evidence and still acknowledges the delivery.
      Bounded: exactly one retry, never a loop.
- [x] Wire `dependency-ledger.mjs` to raw Comm envelopes (`comm.observeRaw()`) and to each
      member's `task`/`dependsOn` in `selected_crew_<uuid>.json`
      (`dependency-ledger-wiring.mjs`). `complete`/`fail`/`blocked` transitions from live
      envelopes are still not wired (no Comm protocol field marks task completion yet).
- [x] Validate the worst-outcome-wins roster rollup against a Lead-present Crew. Confirmed
      by regression test, not a source fix: `applyWorkerStatusToRoster` looks members up by
      `actorId` with no role filtering, so the Lead's terminal outcome already folds into
      the same worst-outcome-wins scan as any specialist.
- [x] Add system-prompt and tool-schema token accounting to worker telemetry. Recorded once
      per worker at `agent_start` inside `worker-comm-extension.mjs` (reuses
      `staticContextTokens`), relayed content-free across the RPC boundary via a marker-
      prefixed `ctx.ui.notify`, decoded by `worker-events.mjs` into a `static_context`
      log record.

## Open

- [ ] Investigate and clean up orphaned `lifecycle-server.mjs` processes from past Main
      sessions. Observed live via `ps`: multiple `lifecycle-server.mjs` processes from prior
      days (e.g. Saturday) still running, unowned by the current Runtime session's `#agents`
      map, so `runtime_cleanup`/`runtime_delete_agent` cannot reach them (those tools only
      iterate agents this session itself spawned). Need either a durable owner/PID record
      per launched Lifecycle server so a later session can find and reap orphans, or a
      liveness/heartbeat convention that lets a stale server self-terminate. Tracked:
      [#465](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/465).
- [x] Surface session-context percent/window in the monitor snapshot and dashboard.
      `formatSessionContext()` renders "percent / model window" per automaton, sourced from
      `worker-metrics.mjs`'s existing `sessionContext` field.
- [x] Build the expandable Crew dashboard (Automata tab + Plan tab) on top of
      `monitor-snapshot.mjs`. `/crew-dashboard` command + `ctrl+shift+d` shortcut open an
      overlay with both tabs; Automata rows are the snapshot's per-actor detail, Plan rows
      come from `selected_crew_<uuid>.json` overlaid with a dependency-ledger snapshot
      seeded fresh on open (no live Comm wiring into the render path yet -- see below).
      Not yet verified in a real TUI: no TypeScript/pi-tui packages are resolvable from a
      plain `node --test` process in this repo, so `monitor.ts`'s new wiring is validated
      the same way its existing wiring already is (source-pattern assertions) plus full unit
      coverage of every pure function underneath. Recommend a manual
      `cc --plugin-dir . --debug` smoke test of `/crew-dashboard` before relying on it.
- [ ] Wire a Comm completion signal so the dependency ledger can transition
      `complete`/`fail`/`blocked` from live envelopes (no such protocol field exists yet).
      Tracked: [#462](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/462).
- [ ] Wire a live `CommController`/dependency-ledger observer into the dashboard's render
      path. The Plan tab currently reseeds a fresh ledger from `selected_crew_<uuid>.json`
      on every open, so it only ever shows structural `waiting`/`ready` state, never a live
      `running`/terminal transition. Blocked by #462. Tracked:
      [#463](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/463).
- [ ] Add an end-to-end dependency test covering parallel roots, chained release, directed
      completion recipients, blocked status, and the Lead final report. Blocked by #462.
      Tracked: [#464](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/464).
- [ ] Bound and deduplicate external transcript posts. A validated run produced repeated
      reports and multi-kilobyte payloads unsuitable as Discussion comments. Tracked:
      [#466](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/466).
- [ ] Mark the GitHub Discussion lifecycle terminal when a run completes or is cleaned up.
      The roster-level terminal rollup is done; the Discussion-adapter side is untouched.
      Tracked: [#467](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/467).
- [x] Fixed the `BLOCKED`-for-a-successful-stop mismatch without adding a fourth outcome.
      `runtime_delete_agent` now accepts an optional `outcome` (`PASS|FAIL|BLOCKED`); when
      Main has already received and accepted a member's report before removing it, it
      declares the real outcome directly (`applyMemberOutcomeToRosterFiles`) instead of
      letting removal be inferred as BLOCKED. The automatic inference path is unchanged and
      still used whenever Main has no such prior knowledge (e.g. a crash).
- [ ] Roster-level rollup uses worst-outcome-wins (any FAIL fails the Crew, else any BLOCKED
      cancels it, else PASS closes it). Validated with a Lead present; still not validated
      against a Crew with a required-vs-optional member distinction.

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
- [x] Add explicit `PASS | BLOCKED | FAIL` outcomes and terminalize unattended blocked runs
      without falsely accepting work.
- [x] Implement the optional GitHub Discussion CommAdapter; base worker capabilities
      remain Comm-only.
