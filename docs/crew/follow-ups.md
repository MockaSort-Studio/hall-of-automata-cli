# Crew Operational Follow-ups

Updated: 2026-08-31

## In progress

- [ ] **Automatic disband after successful close — implemented, E2E pending.**
  After the durable artifact, final Discussion record, and mesh `FINAL` are complete,
  governance now removes every specialist and finally the Lead. Isolated durable
  self-removal passed; verify automatic cleanup in the next uncontaminated Crew run.

## Todo — Discussion protocol (current focus)

- [x] **Provide a canonical kickoff template.** `crew_kickoff` now accepts structured
  objective, acceptance criteria, crew assignments/dependencies, unique references, and
  open questions. The wrapper renders one concise layout and rejects repeated links.
- [ ] **Render clean, valid Discussion messages.** Remove transport labels such as
  `[Broadcast]`, `[Question]`, and similar internal tags from human-visible text.
  Keep signatures and Markdown structurally consistent.
- [ ] **Use explicit canonical addressees.** Ask and tell messages identify their
  target with the roster-derived `@role-persona` handle; broadcasts use `@all`.
  Reject malformed or ambiguous addressing before posting.
- [ ] **Thread responses beneath the triggering comment.** Preserve the source
  comment ID for ask, tell, and broadcast messages, then post responses as GitHub
  Discussion replies instead of unrelated top-level comments.
- [ ] **Define and test message templates by operation.** Cover kickoff, ask, tell,
  broadcast, response, review, and final close rendering plus malformed-input cases.
- [ ] **Close the GitHub Discussion after successful Crew close.** Add a signed,
  roster-aware close operation; do not delete the canonical record.

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
