# Crew and Armory implementation plan

Updated: 2026-09-30. This is the sole active TODO list. `follow-ups.md` and
`armory-implementation-todo.md` retain completed evidence and historical context;
they do not define additional work.

## Phase 0 — freeze live dispatch

No further live Crew canary until Phase 1 passes. Preserve worker configuration,
events, lifecycle records, and QEMU/process evidence outside TUI state before any
retry or cleanup.

## Phase 1 — reliable dispatch and lifecycle (release blocker)

1. [ ] **Define and enforce one kickoff/task protocol.** Decide whether kickoff is
   automatic or explicit, remove the other path, and document the one contract in
   dispatch arming, worker startup, and terminal follow-ups.
2. [ ] **Make leadless messaging usable.** Provide a supported Main-to-Crew/all
   delivery path (or require a Lead); support correlated replies where needed.
3. [ ] **Make partial launch atomic.** Bound Comm/Lifecycle startup and RPC calls;
   on any failure stop processes, invalidate stale clients, terminalize/remove the
   roster, and retire the TUI entry.
4. [ ] **Preserve evidence and make cleanup idempotent.** Archive worker event/log
   evidence before removal; tolerate missing worktrees and stale runtime records.
5. [ ] **Prove the contract with canonical `start_crew` E2E.** A Gondolin canary
   must register, receive exactly the defined initial task, complete one read-only
   operation, report terminal state, and leave no worker, worktree, Comm/Lifecycle,
   QEMU, roster, or TUI entry. Include normal, launch-failure, and owner-death paths.

## Phase 2 — Armory GitHub acceptance

6. [ ] **Complete live GitHub read canary.** Through the guest proxy, list/view one
   permitted issue with `collaboration/pi-github-tools.github_issue_view`; prove no
   host suite execution, no raw credential in worker artifacts, and no mutation.
7. [ ] **Add credential renewal/rotation.** Back `createCredentialVault()` with a
   renewable source and test `secretManager.updateSecret()` and revocation.
8. [ ] **Profile and improve guest startup.** Investigate the approximately 4.8 s
   GitHub `describe` path; retain cold/warm measurements and assess profile-cache
   or snapshot optimization without caching workspace, credential, or live state.

## Phase 3 — runtime correctness and operational security

9. [ ] **Schedule dependency graphs.** Release no-lead dependents only after typed
   successful dependencies; propagate failed/blocked dependencies terminally.
10. [ ] **Define blocked/retry discipline.** Require a structured blocked reason,
    use waiting for expected dependencies, stop work after terminal state, and
    re-dispatch retries with preserved evidence and explicit authority.
11. [ ] **Scope Comm capabilities.** Replace shared credentials with launch-,
    actor-, and namespace-bound admin/observer capabilities; reject replay and
    impersonation.
12. [ ] **Finish typed-state migration.** Remove unused raw-envelope observer APIs;
    either test the current process-per-run reconnect assumption or define replay
    semantics before allowing Comm servers to outlive Main.
13. [ ] **Make external discussion handling bounded.** Keep it on-demand, paginate
    replies independently, and retain deterministic multi-page coverage.
14. [ ] **Make test execution bounded.** Diagnose lingering sockets/processes and
    excessive serial work so the complete Node suite reliably fits CI limits.

## Phase 4 — measurement and product expansion

15. [ ] **Add model-selection policy.** Select model/thinking from task risk and
    scope; record rationale, budgets, and outcome.
16. [ ] **Establish quality/performance evidence.** Capture an untouched baseline,
    run A/B quality gates, and publish three serial-versus-Crew benchmark rounds
    with median/range.
17. [ ] **Define Hall CLI state-model port.** Specify Project/Issue progression,
    dependency management, and GitHub adapter contracts.
18. [ ] **Add Terraform guest suite.** Use the existing Nix guest-runner/proxy
    contract only after GitHub acceptance is complete.

## Exit criteria

Phase 1 is required before any live Crew dispatch. Phase 2 is required before
claiming GitHub credential/Armory acceptance. Phases 3–4 are independently planned
hardening and product work.
