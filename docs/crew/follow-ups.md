# Crew Operational Follow-ups

Updated: 2026-09-01

## In progress

- [ ] **Automatic disband after successful close — implemented, E2E pending.**
  After the durable artifact, final Discussion record, and mesh `FINAL` are complete,
  governance now removes every specialist and finally the Lead. Isolated durable
  self-removal passed; verify automatic cleanup in the next uncontaminated Crew run.

## Completed — Discussion protocol

- [x] **Provide a canonical kickoff template.** `crew_kickoff` now accepts structured
  objective, acceptance criteria, crew assignments/dependencies, unique references, and
  open questions. The wrapper renders one concise layout and rejects repeated links.
- [x] **Render clean, valid Discussion messages.** Deterministic wrappers now reject
  internal transport labels and render consistent semantic headings and signatures.
- [x] **Use explicit canonical addressees.** Ask/tell require one exact roster-derived
  `@role-persona`; broadcasts render `@all`; ambiguous role or prefix lookup is rejected.
- [x] **Thread responses beneath the triggering comment.** Comment tools return GraphQL
  IDs; `crew_reply(replyToId)` posts beneath the source ask, tell, or broadcast comment.
- [x] **Define and test message templates by operation.** Kickoff, finding, ask, tell,
  broadcast, response, review, and final acceptance have focused renderers and tests.
- [x] **Close the GitHub Discussion after successful Crew close.** `crew_close` is
  Lead-only, signed, retry-aware, posts criterion evidence, and calls `closeDiscussion`.
  The mutation was verified by closing completed Discussion #395 without deleting it.

## Todo — Crew runtime

- [ ] Run one uncontaminated end-to-end KR autonomy proof without observer wakeups.
- [ ] Investigate accumulated orphan resident launcher processes.

## Deferred — Hall CLI state-model port

GitHub Issue, Project, label, dependency, and related state transitions will be
revisited when the Hall CLI discipline is ported. They are not part of the current
automata-Crew protocol focus.

- [ ] Move the Project item from `In Progress` to `Done` after verified close.
- [ ] Decide whether closing the tracked Issue is part of Crew close or a separate
  state-management workflow; current `github_issue_update` state handling is broken.

## Completed evidence

- [x] Fabric fork and built runtime moved from `/tmp` to the stable workspace at
  `/Users/michelangelosetaro/Workspace/pi-fabric-policy-design`; Pi settings point there.
- [x] Lead-written `docs/crew-github-state-audit.md` included in repository history.
- [x] Nested durable concurrent recruitment works.
- [x] Cross-turn `status`, `tell`, `steer`, `followUp`, `ask`, `mesh.publish`, and
  nested remove work through the resident supervisor/control plane.
- [x] KR #358 produced independent findings, substantive peer reconciliation,
  Lead review, result-bearing completeness check, artifact, and `FINAL`.
