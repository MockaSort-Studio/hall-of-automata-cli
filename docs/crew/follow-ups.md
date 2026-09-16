# Crew Operational Follow-ups

Updated: 2026-09-01

## Completed — Gate 0 migration cleanup

- [x] **P0 — Audit and clean the migration branch.** `master...dev` was inventoried; the
  canonical Crew path is documented in `runtime-structure.md`. Historical host-specific
  durability/remediation documents and the unsupported code-writing `developer` role were
  removed. The remaining runtime is the project-local Crew, GitHub, and web extensions.
  Full validation remains the release check for this gate.

## Phase 1 — Local evidence before intervention

- [x] **P0 — Recover the KR 7.4 evidence.** `kr74-context-growth-analysis.md` records the
  unchanged-run baseline: 203,339 aggregate retained-context growth, with 79.9% concentrated
  in nineteen jumps of at least 3k tokens. It rules out durable-resume duplication and shows
  that unbounded outer tool results, stale constructor prompts, and turn churn are the causes
  to test rather than assumptions to act on.
- [ ] **P0 — Capture the next run locally before disband.** Persist a queryable per-actor
  timeline containing run/actor identity, role-persona, activation, context high-water and
  delta, response usage, tool-result bytes and names, compactions, errors, and timestamps.
  Keep raw content out of the artifact. Every jump above 2k tokens must have a retained source
  operation or be reported as unexplained growth.
- [ ] **P0 — Establish an untouched comparable baseline.** Rerun one representative Crew
  task with no context limits, result shaping, turn limits, or prompt reduction. Compare its
  final quality and Discussion evidence with KR 7.4 before changing policy.

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

- [ ] **P0 — Add a Fabric host bridge for direct Crew startup.** Pi's supported ExtensionAPI
  cannot call `agents.create` or invoke another registered tool. The Fabric-captured
  `start_crew` therefore prepares portable relative state and its caller must create and wake
  the Lead within the same `fabric_exec` invocation. No generated code is injected into the
  user conversation. Add a versioned Fabric request bridge before claiming atomic startup from
  the extension tool. Do not use nonexistent `pi.agents` or `pi.tools.call` APIs; preserve
  the queued-state claim and completed-run replay rejection.
- [ ] **P0 — Publish artifacts before close.** `crew_close` must require a resolving GitHub
  artifact URL and immutable revision, and refuse to close while evidence is untracked,
  dirty, or unavailable remotely.
- [ ] **P1 — Make final outcomes honest.** Add explicit `PASS | BLOCKED | FAIL` semantics.
  Only `PASS` may mark criteria accepted; blockers must remain visibly unresolved.
- [ ] **P0 — Terminalize unattended blocked runs.** When a Lead has recorded that mandatory evidence cannot be obtained, transition the roster to a terminal `BLOCKED` outcome, remove all actors, and return a durable blocked result without falsely accepting or silently leaving a `started` run idle. Preserve the canonical Discussion and blocker evidence for human follow-up; make cancellation idempotent.
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

## Completed — Main UX and context boundary

- [x] Removed the generated `fabric_exec` user-message bridge and obsolete `/crew-start`
  command; launch preparation and actor activation now remain in one Fabric invocation.
- [x] Queued state is rendered through a TUI-only custom entry; terminal state uses a themed
  Crew result card.
- [x] Main model context receives one bounded semantic Crew result instead of Fabric XML,
  actor metadata, or the full structured transport payload.

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
