# Crew and Armory implementation plan

Updated: 2026-09-30. This is the sole active TODO list. `follow-ups.md` and
`armory-implementation-todo.md` retain completed evidence and historical context;
they do not define additional work.

## Release gate

No live Crew canary until dispatch and lifecycle acceptance pass. Before every
retry or cleanup, archive worker configuration, events, patches, lifecycle
records, and QEMU/process evidence outside TUI state.

## 1. Dispatch control plane

1. [x] **Implement explicit dispatch.** `start_crew` creates a ready run only;
   Main explicitly delivers its first task through Comm. Remove duplicated
   automatic kickoff/direct-prompt paths and apply the contract in dispatch arming,
   worker startup, terminal follow-ups, and tests. See
   [dispatch-control-plane-design.md](dispatch-control-plane-design.md).
2. [x] **Support leadless control.** Provide Main-to-member/all delivery and
   correlated request replies without requiring a Lead. Keep agent all-recipient
   broadcast Lead-only and fail closed with typed capability errors.
3. [x] **Make launch and cleanup transactional.** Wait for worker readiness with
   bounded Comm/Lifecycle startup and RPC calls; on failure stop partial processes,
   invalidate clients, archive evidence, terminalize/retire the roster, and remove
   the TUI entry. Cleanup must tolerate already-missing worktrees, agents, and
   records.

Items 1-3 are implemented and unit/integration tested; their live proof is item 9.

### Resume here (dispatch control plane leftovers)

- [ ] Lead-run activation: Main sends the task to the Lead; Lead dispatches
  validated roots through the broker (not built; Main currently sends directly).
- [ ] Verify roster `done` + TUI entry retirement on launch failure.
- [x] Stop the Comm/Lifecycle servers when a launch rolls back and no other Crew
  uses them (`main-comm.test.mjs`).
- [ ] Restart Pi and verify Main tool registration: `runtime_send_message`,
  `runtime_send_all`, `runtime_request_member`, `runtime_reply_message`,
  `runtime_acknowledge_message`, `runtime_dispatch`.
- [ ] Then run item 9 (one-worker canonical E2E, `microvm: none` first, then
  Gondolin with `collaboration/pi-github-tools.github_issue_view`).

State at handoff: 384 tests, 381 pass, 3 skipped, 0 fail. No live Crew, runtime
or QEMU state remains. Runtime tools are exposed by
`.pi/extensions/hall-crew/crew-runtime/index.ts`; design in
[dispatch-control-plane-design.md](dispatch-control-plane-design.md).

## 2. Lifecycle state redesign

4. [ ] **Specify separate state domains.** Do not use one status for everything:
   model *work* state, process/VM *health*, and resource *disposition* separately.
   Define the Crew and member state machines, legal transitions, terminal outcomes,
   ownership, and persisted fields.
5. [ ] **Make the lifecycle service authoritative and durable.** The service owns
   versioned state plus an append-only transition/audit record. Workers request
   transitions; Main performs administrative transitions; the TUI is query-only.
   Define idempotency, reconnect/replay, stale-writer rejection, and crash recovery.
6. [ ] **Define operational semantics.** Model explicit registration, readiness,
   active work, waiting-for-dependency/input, terminal work result, cleanup, and
   archived evidence. A terminal work result stops further execution; process death
   is health evidence, not an assumed work outcome.
7. [ ] **Define dependency and recovery semantics.** Release dependents only after
   required successful results; propagate failure/block deterministically. For a
   retry, preserve patch/log/configuration evidence, clean the old resource, and
   create a new member attempt linked to the prior terminal result with explicit
   authority.
8. [ ] **Implement and prove the redesign.** Replace raw-envelope lifecycle writers,
   migrate roster/TUI projections, and cover transitions, duplicate messages,
   disconnect/reconnect, worker/owner death, cleanup races, dependency release, and
   recovery/retry.

## 3. Canonical release evidence

9. [ ] **Run canonical `start_crew` E2E.** Prove exact initial-task delivery,
   worker registration, typed lifecycle progression, terminal cleanup, and TUI
   retirement for normal, partial-launch-failure, and owner-death paths.
10. [ ] **Run canonical two-worker Gondolin E2E.** Prove guest-proxy registration,
    shared immutable closure identity, distinct VM/workspaces, Main isolation, and
    no residual worker, worktree, Comm/Lifecycle, QEMU, roster, or TUI state.
11. [ ] **Bound CI validation.** Diagnose lingering sockets/processes and excessive
    serial work so the complete Node suite is deterministic and fits its CI limit.

## 4. Armory GitHub acceptance

12. [ ] **Complete live read-only GitHub canary.** Invoke
    `collaboration/pi-github-tools.github_issue_view` through the guest proxy and
    prove no host suite execution, raw credential artifact, or mutation.
13. [ ] **Add credential renewal and rotation.** Back `createCredentialVault()` with
    a renewable source; test `secretManager.updateSecret()` and revocation.
13a. [~] **Ship the Armory binary cache** (see
    [armory-distribution-decision.md](armory-distribution-decision.md)). Done:
    hall-armory builds and pushes per suite and verifies fetch-only on Ubuntu and
    macOS; suite source is content-addressed; clients root closures; a missing
    cache yields an actionable host-fallback reason; `scripts/setup-env.sh`.
    Remaining: skip client flake evaluation (publish resolved store paths, about
    350 MB and most of the 3 min cold start), move `CACHIX_AUTH_TOKEN` into a
    `main`-restricted Environment, then the Gondolin `github_issue_view` canary.
14. [ ] **Profile guest startup.** Measure cold/warm GitHub `describe` (currently
    about 4.8 s) and assess safe profile-cache/snapshot reuse without caching a
    workspace, credential, or live worker state.

## 5. Release-quality policy

15. [ ] **Scope Comm capabilities.** Replace shared credentials with launch-, actor-,
    namespace-, and observer-bound capabilities; reject replay and impersonation.
16. [ ] **Add model-selection policy.** Choose model/thinking from task risk and
    scope; record rationale, budgets, and outcome.
17. [ ] **Establish quality/performance evidence.** Capture a baseline, run an A/B
    quality gate, and publish three serial-versus-Crew rounds with median/range.

## 6. Setup UX (last)

18. [ ] **Add `/hall-setup`: the entry point for setting up a new machine.** A
    Pi command that runs `scripts/setup-env.sh` through the OS's graphical
    elevation (`osascript ... with administrator privileges` on macOS, `pkexec`
    on Linux), because Pi's TUI owns the terminal and a plain `sudo` prompt
    cannot work. One native password dialog installs Nix and the Armory cache.
    It is explicit-only (a Crew never installs anything), pins the Nix installer
    to a tag, and its preflight message points here. Verify the dialog manually
    on macOS and Linux; the script itself is covered by `setup-env.test.mjs`.
    Rationale and alternatives: [armory-distribution-decision.md](armory-distribution-decision.md).

## Deferred until after Crew release

- Hall CLI state-model port and GitHub adapter contracts.
- Terraform guest suite.
