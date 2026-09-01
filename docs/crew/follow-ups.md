# Crew Operational Follow-ups

Updated: 2026-09-01

## In progress

- [x] **Automatic disband after successful close.** KR 7.4 closed its Discussion,
  emitted `FINAL`, then removed both specialists and the Lead without observer input.

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
  The close mutation was verified live; the original test fixture was later removed.

## Todo — Crew runtime

- [x] KR 7.4 ran end to end without observer wakeups or steering.
- [x] Fixed orphan resident launchers in the stable Fabric fork. The launcher now
  closes RPC stdin after owner release and suppresses duplicate startup children; focused
  tests and a live self-removal/idle-exit probe passed.

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
