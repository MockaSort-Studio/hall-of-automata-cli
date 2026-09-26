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

- [x] Audit context and persona assembly after the SDK port. The "obsolete Claude
      consultation overlay" was already fully removed prior to this session (commit
      `3bcb74b`, closing KR 2.3/#185 and KR 5.1/#195) -- confirmed via grep, no removal work
      needed. Confirmed `automaton-body/` + `roster.json` + `roles.json`/`roles/*.md`
      (assembled by `assembly.mjs`, wrapped by `startup.mjs`) are the sole persona source
      with no dead alternate path anywhere in the tree. Added the missing bounded
      prompt-snapshot test (`tests/crew/startup.test.mjs`) asserting the assembled prompt's
      section order and ordinal-suffixed Crew handle substitution. No sitewide max-prompt-
      size concept exists (only per-field caps); the test's size bound is a derived soft
      heuristic, not a hard product decision -- flagged, not invented as fact.
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
      (originally `closed`/`failed`/`cancelled`, later simplified to a single `done` value —
      see the roster-status simplification entry below) once every member is terminal —
      including when workers are stopped one at a time across separate calls, not only in a
      single batch.
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
      envelopes were wired later in this doc (see the `taskStatus` entry below, #462).
- [x] Validate the worst-outcome-wins roster rollup against a Lead-present Crew. Confirmed
      by regression test, not a source fix: `applyWorkerStatusToRoster` looks members up by
      `actorId` with no role filtering, so the Lead's terminal outcome already folds into
      the same worst-outcome-wins scan as any specialist.
- [x] Add system-prompt and tool-schema token accounting to worker telemetry. Recorded once
      per worker at `agent_start` inside `worker-comm-extension.mjs` (reuses
      `staticContextTokens`), relayed content-free across the RPC boundary via a marker-
      prefixed `ctx.ui.notify`, decoded by `worker-events.mjs` into a `static_context`
      log record.

## Dashboard and dependency-ledger completion — resolved

- [x] Investigate and clean up orphaned `lifecycle-server.mjs` processes from past Main
      sessions. `lifecycle-registry.mjs` records one owner file per launched Lifecycle
      server (its host Main-session PID); `Runtime#ensureLifecycle()` best-effort reaps any
      record whose host PID is dead before spawning its own, and a manual
      `runtime_reap_orphans` tool covers out-of-band cleanup. Tracked:
      [#465](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/465).
- [x] Surface session-context percent/window in the monitor snapshot and dashboard.
      `formatSessionContext()` renders "percent / model window" per automaton, sourced from
      `worker-metrics.mjs`'s existing `sessionContext` field.
- [x] Build the expandable Crew dashboard (Automata tab + Plan tab) on top of
      `monitor-snapshot.mjs`. `/crew-dashboard` command + `ctrl+shift+d` shortcut open an
      overlay with both tabs, Automata rows the snapshot's per-actor detail, Plan rows now
      backed by a live dependency ledger (see the next entry, #463) rather than a reseeded
      structural-only one. Not yet verified in a real TUI: no TypeScript/pi-tui packages are
      resolvable from a plain `node --test` process in this repo, so `monitor.ts`'s wiring is
      validated the same way its existing wiring already is (source-pattern assertions) plus
      full unit coverage of every pure function underneath. Recommend a manual
      `cc --plugin-dir . --debug` smoke test of `/crew-dashboard` before relying on it. The
      dashboard's current rendering (single padded-string rows, no explicit overlay size) is
      being reworked into a proper ~1/3-screen table panel -- see Open below (#469).
- [x] Wire a Comm completion signal so the dependency ledger can transition
      `complete`/`fail`/`blocked` from live envelopes. A `kind: "report"` payload's
      `taskStatus` field (`complete`/`failed`/`blocked`), keyed by the envelope's own
      `from`, drives `dependency-ledger-wiring.mjs`'s `attachRawEnvelopeObserver` alongside
      the existing kickoff handling. Tracked:
      [#462](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/462).
- [x] Wire a live `CommController`/dependency-ledger observer into the dashboard's render
      path. `CommController` gained a `comm.observe_raw` WS method (`comm-raw-observer-sockets.mjs`)
      and `Runtime.observeRawComm()`; `monitor.ts` now keeps one live ledger
      (`monitor-live-ledger.mjs`, wired via `attachRawEnvelopeObserver`) per active Crew run
      instead of `planRowsFor` reseeding a fresh one on every dashboard open, so the Plan tab
      shows real `running`/terminal status. Tracked:
      [#463](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/463).
- [x] Add an end-to-end dependency test covering parallel roots, chained release, directed
      completion recipients, blocked status, and a final resolved-state report
      (`tests/runtime/dependency-ledger-e2e.test.mjs`, over a real WS `CommController`).
      Tracked: [#464](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/464).
- [x] Bound and deduplicate external transcript posts. `discussion-body.mjs` truncates a
      posted report to 4000 characters with a pointer back to the originating Comm delivery,
      and skips an identical repost to the same recipient via a bounded content-digest
      dedupe. Tracked: [#466](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/466).
- [x] Mark the GitHub Discussion lifecycle terminal when a run completes or is cleaned up.
      `roster-discussion-close.mjs` posts an idempotent closing comment once a roster reaches
      terminal rollup, wired into both `runtime_cleanup` and `runtime_delete_agent`. A future
      terminal-rollup write path outside those two tools will need the same wiring. Tracked:
      [#467](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/467).
- [x] Fixed the `BLOCKED`-for-a-successful-stop mismatch without adding a fourth outcome.
      `runtime_delete_agent` now accepts an optional `outcome` (`PASS|FAIL|BLOCKED`); when
      Main has already received and accepted a member's report before removing it, it
      declares the real outcome directly (`applyMemberOutcomeToRosterFiles`) instead of
      letting removal be inferred as BLOCKED. The automatic inference path is unchanged and
      still used whenever Main has no such prior knowledge (e.g. a crash).

## Open

- [x] Fixed the Crew monitor's single-active-Crew assumption. The footer now renders one
      compact line per active roster (`monitor-active-rosters.mjs`, bounded to
      `MAX_ACTIVE_ROSTERS = 5`, most-recently-touched first) instead of `latestActive()`
      silently dropping a second concurrent Crew from view. `/crew-dashboard` shows a
      `SelectList` picker (`monitor-dashboard-picker.mjs`, per `tui.md`'s documented
      pattern) when more than one Crew is active; with 0 or 1, behavior is unchanged.
      `monitor-footer-widget.mjs` and `monitor-worker-metrics.mjs` were extracted to keep
      `monitor.ts` at 197 lines.
- [x] Rebuild the Crew dashboard as a structured, comfortably-spaced panel (~1/3 of the
      terminal width) with real table rendering for both tabs. `monitor-dashboard-view.mjs`
      gained a shared `renderTable()` primitive (fixed columns sized to content, one flex
      column absorbing remaining width) and the overlay got explicit `overlayOptions`
      (`width: "50%"`, `minWidth: 120`, `maxHeight: "80%"`). Real border/background chrome
      followed separately (`monitor-dashboard-chrome.mjs`: `DynamicBorder` top/bottom rule +
      `Box` background band -- `Box` has no native border, checked its source first).
      [#469](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/469).
- [x] Fixed the dashboard overlay's initial `width: "33%"`/`minWidth: 70` rendering
      illegibly narrow on real terminals. Traced to `pi-tui`'s `resolveOverlayLayout`
      (`width = Math.max(width, opt.minWidth)`): `minWidth` is an unconditional floor, not
      a fallback, so it dominates the percentage target on any terminal under
      `minWidth / (percentage / 100)` columns -- ~212 for the original numbers, i.e. almost
      always. The 70-column floor was also below the Automata table's own real minimum
      content width. Recomputed `minWidth: 120` from `AUTOMATA_COLUMNS`' actual widths
      (fixed columns + separators + a full Crew handle in the flex NAME column, not a
      guess) and raised `width` to `50%` so wide terminals genuinely grow the panel instead
      of pinning to the floor. Left an explicit comment on the gotcha so it isn't
      reintroduced.
- [x] Added breathing room to the dashboard overlay: one blank line after the tab bar, one
      before the closing border, in `monitor-dashboard-view.mjs` (kept in the pure content
      module, not the chrome wrapper, since the tab bar/table are assembled there). Overlay
      sizing itself is untouched -- height stays intentionally content-driven.
- [x] Roster-level rollup uses worst-outcome-wins (any FAIL fails the Crew, else any BLOCKED
      cancels it, else PASS closes it). Validated with a Lead present. Considered and
      rejected a required-vs-optional member distinction: the smallest-party discipline
      already means every dispatched member's task is load-bearing, and an open-ended task
      that legitimately has no firm answer should be scoped to report `PASS` with its
      finding, not `BLOCKED`/`FAIL` -- adding an "optional" escape hatch would just let a
      real stall or failure get silently absorbed instead of surfacing.
- [x] Simplified the roster-level _terminal_ status model from three values
      (`closed`/`failed`/`cancelled`) down to one (`done`). The worst-outcome-wins ordering
      above still determines the representative per-member outcome selected during rollup,
      but every outcome now maps to the same terminal roster status; per-member detail
      (`PASS`/`BLOCKED`/`FAIL` in `lifecycle-state.mjs`/`roster-lifecycle.mjs`) is unchanged
      and remains the finer-grained source the footer/dashboard read from. Updated
      `roster-lifecycle.mjs`, `monitor-state.mjs`'s `isTerminalCrew`, `roster-terminal.mjs`'s
      `terminalizeRoster`, `startup.mjs`'s launch-failure path, and `comm.mjs`'s
      `crew_finish_close`/`beginClose`/`markDiscussionClosed` paths; `discussion-body.mjs`'s
      three-sentence `TERMINAL_STATUS_LABEL` lookup was deleted in favor of one generic
      closing comment.
- [x] Fixed the footer/Automata tab never showing `complete`/`blocked`/`failed` promptly.
      A member's roster-recorded status only ever advances when Main explicitly acts
      (records an outcome, or removes/infers one on stop); a worker's own completion
      report already updated the live dependency ledger immediately (#462/#463), but
      nothing fed that into the footer/Automata tab's bucket derivation, only the Plan tab
      consulted it. Added `dependency-ledger-wiring.mjs`'s `ledgerStatusByActor()` (actorId-
      keyed fold, mirrors the existing handle-keyed `readableDependencyLedgerSnapshot()`)
      and wired it into `monitor-snapshot.mjs`'s bucket precedence: explicit roster status
      (Main-authoritative) > live ledger terminal status (worker-reported) > live-activity
      heuristic (queued/running) > queued. Also fixed a real, unrelated bug found while
      reconciling this: `lifecycle-owner-integration.test.mjs` imported but never used
      `mkdtempSync`/`rmSync`, so it ran against the literal repo `cwd` and could collide
      with any real Runtime's owner file already on disk -- isolated to a per-test temp cwd.
      This fix had no real effect on its own -- see the next entry, which found the actual
      root cause.
- [x] Fixed the real root cause of the footer never transitioning: the live dependency
      ledger never matched a real Comm envelope in the first place. A real worker's Comm
      actorId is namespace-qualified (`crew-<runId>-<handle>`, e.g.
      `crew-521574dc-...-developer-snowball-00`); `dependency-ledger-wiring.mjs` seeded the
      ledger with the bare handle from `selected_crew_<uuid>.json`, and
      `canonicalHandle()` never strips a namespace prefix. `ledger.has()`/`status()`
      therefore never matched a real envelope's `to`/`from` field -- no ledger node had
      ever actually left `waiting` in any live dispatch, only in unit tests that emitted
      bare handles directly. This included the prior "end-to-end" test
      (`tests/runtime/dependency-ledger-e2e.test.mjs`), which used the real WebSocket
      transport but not the real actor-id shape -- exactly where the bug lived, and exactly
      why that test didn't catch it. `attachRawEnvelopeObserver()` now takes an explicit
      `namespace` argument and strips `<namespace>-` from `to`/`from` before matching;
      `monitor-live-ledger.mjs` passes `crew-${selected.runId}`. Rewrote the e2e test to use
      real namespace-qualified actor IDs end to end, and added explicit regression tests
      for the namespaced-envelope shape in `dependency-ledger-wiring.test.mjs` and
      `monitor-live-ledger.test.mjs`.
- [x] Fixed the Plan tab being stuck at `waiting` in a real TUI session. The monitor now
      connects directly to each roster's `roster.comm.url` using `comm-client.mjs`'s
      `connectComm()`/`observeRaw()` path, registering a dedicated `observer-<runId>` actor
      rather than hijacking `main`. `monitor-live-ledger.mjs` maintains one connection per
      active run and tears it down when the plan changes or tracking stops. Added a real
      independent-WebSocket test covering `waiting -> running -> complete`, run isolation,
      teardown, and structural fallback. Namespace-qualified actor regression coverage is
      preserved. Manual live `cc --plugin-dir . --debug` TUI smoke verification remains
      recommended.
- [x] Fixed context percent/window never showing (`"\u2014 / \u2014"` for every automaton,
      every Crew, all session). Confirmed the diagnosis first: `worker.json`'s launch config
      genuinely has no `model` field populated when a member's `automaton-body` sets none
      (`assembly.mjs`'s `...(body.model ? { model: body.model } : {})`), so `worker.mjs`
      never passes `--model` and the RPC child inherits whatever default `pi --mode rpc`
      resolves to -- nothing captured or relayed that resolved id back.
      `resolveModelWindow(undefined)` correctly stays `null` by design; the bug was upstream
      of it, not in it. Fix: `worker-comm-extension.mjs`'s existing `agent_start` handler now
      also reads `ctx.model` (the RPC session's actually-resolved model, per `rpc.md`'s
      `get_state`/`Model` type and `extensions.md`'s `ctx.model`) and relays it content-free
      via a sibling marker (`RESOLVED_MODEL_MARKER` in `worker-events.mjs`, decoded into a
      `resolved_model` log record next to the existing `static_context` one).
      `worker-metrics.mjs`'s `summarizeWorkerEvents` now derives `modelWindow` from that
      record via `resolveModelWindow()` whenever no explicit `modelWindow` override is
      passed in -- an explicit override (tests, or a caller with real launch-config
      knowledge) still wins. This fixes both real consumers: `lifecycle-controller.mjs`
      (previously passed `resolveModelWindow(agent.model)`, `null` whenever `agent.model`
      was unset) and, more importantly, `monitor-worker-metrics.mjs` -- the actual
      dashboard/footer path -- which previously called `summarizeWorkerEvents` with no
      `modelWindow` argument at all, so it was unconditionally `null` for every automaton
      regardless of this fix's other half. New coverage:
      `worker-events.test.mjs` (marker encode/decode, malformed/empty payload),
      `worker-comm-extension-resolved-model.test.mjs` (split out to keep
      `worker-comm-extension.test.mjs` at its original size: `ctx.model` present/absent),
      `worker-metrics.test.mjs` (derivation, unknown-model-stays-null, explicit-override-
      wins), and `monitor-worker-metrics.test.mjs` (end-to-end through the real dashboard
      read path). Known residual limitation, out of this bounded fix's scope: `ctx.model.id`
      may be a dated provider id (e.g. `claude-sonnet-4-20250514`) that doesn't match
      `model-window.mjs`'s `KNOWN_WINDOWS` table's undated keys -- that table's own
      maintenance is a separate concern from "is the real id ever relayed at all", which is
      what was broken here. The follow-up telemetry pass now also relays the active model's
      own `ctx.model.contextWindow` alongside its id, so dated or newly catalogued ids no
      longer depend on the hand-maintained `KNOWN_WINDOWS` table; unknown legacy event logs
      without that field remain intentionally null. The footer now includes a compact
      `context percent / window` summary (maximum observed percent for the Crew; `mixed`
      when members use different windows).

## Typed live-state snapshot/subscription — resolved (this session)

- [x] Made the Comm server the live state owner instead of the TUI. Main
      registers each run's static plan (`comm.register_plan`); workers then
      update only their own node through the separate typed
      `comm.lifecycle_update` RPC (`running`, `complete`, `blocked`, or
      `failed`). Free-form Comm envelopes never change lifecycle state.
      `comm-state-owner.mjs` validates the namespaced actor identity and
      legal dependency-ledger transition, then exposes the unchanged typed
      snapshot/subscription API (`comm.state_snapshot`/`comm.observe_state`).
- [x] The TUI remains a read-only projection. `monitor-live-ledger.mjs` reads
      static node identity locally and overlays only server-reported lifecycle
      state; it neither parses reports nor computes DAG transitions. The
      worker receives `lifecycle_update` as a dedicated tool and the shared
      Crew discipline requires it at terminal work states without constraining
      normal `comm_notify`/request/reply collaboration. Transport remains the
      portable existing WebSocket/Comm channel. Coverage verifies owner
      transitions, WS snapshot/subscription, worker tool routing, and a TUI
      tracker driven by real typed lifecycle updates.
- [x] Smoke-verified after a Pi restart with a retained one-member Crew using
      `openai-codex/gpt-5.6-luna`: delivery moved the node to `running`, the
      worker explicitly set `complete`, and an independent
      `comm.state_snapshot` query returned `complete`. The worker used its
      reported `272k` model window; no files were modified. The Crew was kept
      alive for dashboard inspection before deliberate cleanup.
- [ ] Remove now-unused raw-envelope observer APIs (`Runtime.observeRawComm`,
      `comm.observe_raw`, `RawObserverSockets`, and raw-envelope-to-ledger
      tests). They have no production consumer after lifecycle updates became
      the sole state writer; retain no diagnostic API without an explicit
      purpose.
- [ ] Remaining staged-migration step, not implemented here: today
      `registerPlan()` is idempotent per namespace but has no explicit replay
      contract for a Comm server that outlives Main's own process across a
      later reconnect (e.g. a Lifecycle server surviving Main and the TUI
      reattaching later needing the same snapshot mid-run) -- in practice this
      already works today because `comm-server.mjs` is spawned once per Crew
      run and stays up for that run's lifetime, so a later `comm.state_snapshot`
      call always reaches the same live owner; this is a documented
      assumption, not yet a tested guarantee, and would need its own
      dedicated multi-reconnect test if the process-per-run assumption is
      ever relaxed. Also out of scope here: benchmarking
      `comm.observe_state`'s per-envelope compact-update push against a
      large plan (tens of nodes) -- deferred with the existing benchmark
      work below, not rejected.

## Evidence and performance work

- [x] Capture a per-actor, content-free timeline for the next representative run. Rejected:
      aggregate per-actor stats (`worker-metrics.mjs`, `crew-monitor.mjs`, the dashboard)
      already cover what's needed; an ordered per-turn sequence is not something we
      currently have a use for.
- [ ] Establish an untouched baseline, then run an A/B quality gate before changing prompt
      or context policy. Deferred, not rejected: this is worth having once Crew itself is
      stable. Building a formal evaluation harness on top of a system still finding and
      fixing collision/telemetry/dashboard bugs (this session) would be premature -- revisit
      once the runtime hardening backlog is genuinely quiet.
- [ ] Run three controlled serial-versus-Crew benchmark rounds and publish median/range;
      the current single pilot is not a performance decision. Same deferral as above.

## Deferred product work

- [ ] Define the Hall CLI state-model port: Project progression, Issue closure, dependency
      management, and associated GitHub adapter contracts.
- [x] Add explicit `PASS | BLOCKED | FAIL` outcomes and terminalize unattended blocked runs
      without falsely accepting work.
- [x] Implement the optional GitHub Discussion CommAdapter; base worker capabilities
      remain Comm-only.

## Lifecycle state-management follow-up

- [ ] Make lifecycle disposition mechanically disciplined: require a structured escalation
      reason for terminal `blocked`, reject ordinary implementation/test friction as
      `blocked`, and use resumable `waiting` for expected dependencies or input. Ensure an
      active worker cannot keep executing after a terminal update without an explicit Main
      intervention, and record the reason in the typed snapshot for auditability.
- [ ] Add workload-aware Crew model selection. Select model and thinking from task risk,
      boundedness, required edits, and test/integration scope; cap/reassign agents whose
      turn or error budget signals a retry loop. Record the selection rationale and outcome
      so future dispatches can tune the policy instead of treating model choice as static.
- [ ] Replace the shared Comm credential with launch-scoped, actor- and namespace-bound
      capabilities; Main retains an admin credential and observers get read-only run-scoped
      credentials. Reject replay, impersonation, and absent server-owned namespace binding.
- [ ] Paginate GitHub Discussion replies independently of top-level comments and add a
      deterministic second-page reply fixture, preserving bounded transcript behavior.
- [ ] Make the broad Node test command deterministic and bounded: identify lingering
      sockets/processes or excessive serial work so a complete suite can finish within the
      CI timeout while preserving its real integration coverage.
