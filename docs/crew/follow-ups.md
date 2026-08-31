# Crew Operational Follow-ups

Updated: 2026-08-31

## In progress

- [ ] **Automatic disband after successful close — implemented, E2E pending.**
  After the durable artifact, final Discussion record, and mesh `FINAL` are complete,
  governance now removes every specialist and finally the Lead. Isolated durable
  self-removal passed; verify automatic cleanup in the next uncontaminated Crew run.

## Todo

- [ ] **Close the GitHub Discussion after successful Crew close.** Add a signed,
  roster-aware close operation; do not delete the canonical record.
- [ ] Move the Project item from `In Progress` to `Done` after verified close.
- [ ] Decide whether closing the tracked Issue is part of Crew close or a separate
  state-management workflow; current `github_issue_update` state handling is broken.
- [ ] Run one uncontaminated end-to-end KR autonomy proof without observer wakeups.
- [ ] Investigate accumulated orphan resident launcher processes.

## Completed evidence

- [x] Fabric fork and built runtime moved from `/tmp` to the stable workspace at
  `/Users/michelangelosetaro/Workspace/pi-fabric-policy-design`; Pi settings point there.
- [x] Lead-written `docs/crew-github-state-audit.md` included in repository history.
- [x] Nested durable concurrent recruitment works.
- [x] Cross-turn `status`, `tell`, `steer`, `followUp`, `ask`, `mesh.publish`, and
  nested remove work through the resident supervisor/control plane.
- [x] KR #358 produced independent findings, substantive peer reconciliation,
  Lead review, result-bearing completeness check, artifact, and `FINAL`.
