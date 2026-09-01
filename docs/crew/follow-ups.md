# Crew Operational Follow-ups

Updated: 2026-09-01

## Gate 0 — Clean `dev` before further runtime work

- [ ] **P0 — Audit and clean the migration branch.** Inventory `master...dev`, identify the
  canonical Pi Crew execution path, and remove obsolete spikes, duplicate implementations,
  stale compatibility code, generated runtime state, and documentation that describes paths
  we no longer support. Preserve the stable Fabric sibling commits and current GitHub tools.
  Finish with the full validation suite, a reviewable tree, and a documented folder structure.
  No observability or context-policy implementation starts before this gate passes.

## Phase 1 — Observability before intervention

- [ ] **P0 — Evaluate and pin `pi-langfuse`.** Review the third-party extension source and
  choose cloud versus self-hosted Langfuse before installation. Pin an exact package version;
  never commit credentials. Define a privacy policy explicitly—metadata-only cannot diagnose
  tool payload growth, while full-debug can upload prompts, source, and tool I/O. Keep source
  metadata disabled unless separately approved.
- [ ] **P0 — Prove Langfuse sees the whole durable Crew.** A root Pi trace is insufficient.
  Verify that Lead and specialist generations, tool calls/results, errors, usage, cost, and
  resumed durable activations appear in Langfuse. Correlate every trace with Crew run ID,
  actor ID, role-persona, activation, Discussion, and git revision. If `pi-langfuse` cannot
  carry those fields through Fabric children, add the smallest Fabric/Crew bridge required.
- [ ] **P0 — Establish an untouched baseline trace.** Rerun one representative Crew task
  without context limits or turn limits. Produce a queryable timeline of prompt size,
  model-facing tool-result size, context high-water, compaction, latency, failures, and final
  quality for each actor. Langfuse payload truncation protects telemetry ingestion; it must
  not be mistaken for model-context truncation.
- [ ] **P1 — Keep a durable local run artifact.** Langfuse augments rather than replaces
  repository evidence. Before disband, persist the trace/session IDs, runtime, per-response
  context delta, tool name and model-facing result bytes, usage, compaction events, errors,
  and lifecycle timestamps. Every unexplained jump above 2k tokens must remain visible as an
  observability failure rather than disappear with actor-local sessions.

## Phase 2 — Evidence-driven context and discipline

- [ ] **P1 — Focus constructor context.** Use baseline traces to remove irrelevant inherited
  Claude-era routing, duplicate policy, and persona material that does not change Crew
  behavior. Pin the Crew contract instead of fetching mutable prompt text at assembly time.
  Judge reductions by retained behavior and trace deltas, not an arbitrary character quota.
- [ ] **P1 — Focus evidence discipline.** Teach and test search-before-read, staged bounded
  retrieval, compact decision-oriented `fabric_exec` returns, raw evidence written to
  artifacts, and an explicit evidence ledger. Do not impose a turn budget: legitimate review,
  challenge, and revision loops must remain available.
- [ ] **P1 — Change context policy only after traces identify the boundary.** Use comparable
  runs to decide whether model-facing result shaping, targeted compaction, or other runtime
  controls are warranted. Any intervention must preserve task quality and Crew autonomy; a
  lower token count with weaker review is a regression.
- [ ] **P1 — Run an A/B quality gate.** Repeat the same task and model with baseline versus
  focused prompts/discipline. Compare context growth, tool payloads, cost, runtime, evidence
  coverage, review quality, and outcome correctness. Adopt only changes with trace-backed
  improvement and no loss of substantive Crew behavior.

## Remaining KR 7.4 protocol debt

- [ ] **P0 — Make `start_crew` actually start the Crew.** It currently writes config,
  injects executable code as a delayed user follow-up, and calls that “started.” It must
  create and wake the Lead directly, return its actor ID, and reject completed-run replay.
- [ ] **P0 — Publish artifacts before close.** `crew_close` must require a resolving GitHub
  artifact URL and immutable revision, and refuse to close while evidence is untracked,
  dirty, or unavailable remotely.
- [ ] **P1 — Make final outcomes honest.** Add explicit `PASS | BLOCKED | FAIL` semantics.
  Only `PASS` may mark criteria accepted; blockers must remain visibly unresolved.
- [ ] **P1 — Thread the whole review chain.** Add `replyToId` to Lead reviews and
  qualifications; responses and reviews belong under the triggering finding.
- [ ] **P1 — Verify resident shutdown in a full Crew run.** The next full Crew must leave
  zero actors, no `owner.json`, and no launcher/RPC process after the idle window.

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
