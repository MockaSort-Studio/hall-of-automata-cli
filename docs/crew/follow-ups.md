# Crew Operational Follow-ups

Updated: 2026-09-01

## Todo — KR 7.4 quality debt (current priority)

- [ ] **P0 — Make `start_crew` actually start the Crew.** It currently writes config,
  injects executable code as a delayed user follow-up, and calls that “started.” The stale
  launch message arrived after KR 7.4 had already finished. `start_crew` must create and wake
  the Lead directly, return its actor ID, and reject replay of a completed run.
- [ ] **P0 — Stop speculative Lead startup.** The Lead guessed a nonexistent
  `roles/specialist.mjs` and probed historical rosters before listing available sources. Give
  it a constructor-visible manifest of roles, souls, and communication contracts. Require
  search/list before reads; unrelated read failures must not abort an entire evidence batch.
- [ ] **P0 — Enforce context budgets.** KR 7.4 ended at 84,529 Lead tokens, 81,181
  executor tokens, and 53,969 auditor tokens. Raw source and tool traces were allowed to
  flood warm context. Cap individual tool evidence returned to context, summarize large
  outputs into artifacts, and require compaction before an actor exceeds a defined ceiling.
  A run with an actor above the ceiling fails this gate.
- [ ] **P0 — Publish artifacts before close.** KR 7.4 closed while its report was an
  untracked local file. A path is not durable evidence. `crew_close` must require a resolving
  GitHub artifact URL and immutable revision, and refuse to close while the artifact is
  untracked, dirty, or unavailable remotely.
- [ ] **P1 — Make final outcomes honest.** `crew_close` rendered “Final acceptance” for
  a `BLOCKED` KR and checked every criterion. Add explicit `PASS | BLOCKED | FAIL` outcome
  semantics. Only `PASS` may mark criteria accepted; blockers and unmet criteria must remain
  visibly unresolved.
- [ ] **P1 — Thread the whole review chain.** Six top-level comments produced only one
  reply. Add `replyToId` to Lead reviews and qualifications. Top-level comments should be
  limited to independent findings and the final result; responses and reviews belong under
  the triggering finding. Add a threading-coverage assertion to protocol tests.
- [ ] **P1 — Capture metrics before destructive disband.** Actor removal deleted the
  actor-local sessions before metrics collection. Snapshot runtime, per-actor context, token
  usage, failures, and lifecycle timestamps into a run artifact before removing specialists.
  Observer reconstruction from unrelated Pi session retention is not an acceptable design.
- [ ] **P1 — Verify resident shutdown in a full Crew run.** Fabric commit `3d14aaa`
  passed focused tests and a live self-removal probe, but that is not the final acceptance
  gate. The next full Crew must leave zero actors, no `owner.json`, and no launcher/RPC
  process after the idle window.

## Completed — Discussion protocol

- [x] **Canonical kickoff template.** Structured objective, acceptance criteria, crew
  assignments/dependencies, unique references, and open questions; repeated links rejected.
- [x] **Clean Discussion messages.** Deterministic semantic headings and signatures;
  internal transport labels rejected.
- [x] **Canonical addressees.** Ask/tell require exact `@role-persona`; broadcast uses
  `@all`; ambiguous role or prefix lookup rejected.
- [x] **Threaded responses.** `crew_reply(replyToId)` posts below ask, tell, or broadcast.
- [x] **Operation templates.** Kickoff, finding, ask, tell, broadcast, response, review,
  and final-result renderers have focused tests.
- [x] **Discussion close.** Lead-only, signed, retry-aware `crew_close` posts the final
  record and calls `closeDiscussion` without deleting the canonical record.

## Completed — Crew runtime

- [x] KR 7.4 ran end to end without observer wakeups or steering.
- [x] KR 7.4 closed its Discussion, emitted `FINAL`, then removed both specialists and
  the Lead without observer input.
- [x] Fixed orphan resident launchers in the stable Fabric fork. The launcher now closes
  RPC stdin after owner release and suppresses duplicate startup children; focused tests
  and a live self-removal/idle-exit probe passed.

## Deferred — Hall CLI state-model port

GitHub Issue, Project, label, dependency, and related state transitions will be revisited
when the Hall CLI discipline is ported. They are not part of the current Crew protocol work.

- [ ] Move the Project item from `In Progress` to `Done` after verified close.
- [ ] Decide whether Issue closure belongs to Crew close or a separate workflow; current
  `github_issue_update` state handling is broken.

## Completed evidence

- [x] Fabric source and runtime live in the stable workspace; Pi settings point there.
- [x] Nested durable concurrent recruitment works.
- [x] Cross-turn `status`, `tell`, `steer`, `followUp`, `ask`, `mesh.publish`, and
  nested remove work through the resident supervisor/control plane.
- [x] KR 7.3 demonstrated independent findings, substantive peer reconciliation, Lead
  review, result-bearing completeness check, artifact, and `FINAL`.
- [x] KR 7.4 demonstrated autonomous recovery, independent blocker convergence, a
  threaded cross-review, closed Discussion, `FINAL`, and actor disband.
