# Durable Remote Actor Routing — Upstream Work Log

Date: 2026-08-31
Working tree: `/Users/michelangelosetaro/Workspace/pi-fabric-policy-design`
Upstream base: `monotykamary/pi-fabric` at `3393b74`
Status: verified and pushed to `MockaSort-Studio/pi-fabric:dev` (`122c9e9`, `3d14aaa`); not proposed to the upstream parent.
Fork: https://github.com/MockaSort-Studio/pi-fabric/tree/dev
Upstream issue: https://github.com/monotykamary/pi-fabric/issues/92

The validated branch remains based on upstream `3393b74`. Fork `main` has since advanced to
`37427c9`, so `dev` currently diverges from `main`; rebase and full regression verification
are required before opening an upstream pull request.

## Goal

A durable actor created by a nested durable parent must remain discoverable,
communicable, and removable after the parent's activation process exits and
resumes. Main must not mediate these operations.

## Reproductions

### Recruitment race

The resident host created a durable actor, immediately called `cede()` on it,
and then waited to adopt it back. A second create observed the first actor as
unmanageable and failed with:

```text
Fabric actor registry is owned by another host
```

### False host-exit report

The nested recruitment client reconstructed `owner.json` from its requests path
and duplicated the `residency` directory segment. It reported:

```text
Root resident host exited while creating durable actor
```

even while the resident host was alive.

### Cross-turn communication failure

1. Durable parent created a durable child.
2. Parent completed its turn and resumed in a fresh process.
3. Parent called `agents.ask({id: childId, ...})`.
4. Result: `Unknown Fabric actor: <childId>`.

The child existed in the resident registry, but `ask` required a local
`ActorManager` row before consulting the participant directory.

## Design decisions

- The resident host is already the authoritative owner of actors it creates; it
  must not cede them to itself.
- Filesystem request/response is reserved for authoritative lifecycle mutations.
- `ask` and `tell` remain on the participant directory + Fabric control plane.
- Local absence does not mean actor absence: the participant directory is the
  live remote-owner authority.
- One target resolver supplies consistent local/remote actor semantics.
- No Crew- or Hall-specific behavior belongs in Fabric.

## Implemented changes

### `src/residency/host.ts`

- Removed create→cede→self-adopt from resident `createActor` handling.
- Resident request processing remains sequential and ownership-fenced.

### `src/residency/actor-client.ts`

- Generalized the former `ResidentRecruitmentClient` into
  `ResidentActorClient`.
- Supports `createActor` and `removeActor` lifecycle mutations.
- Stores and checks the canonical resident `owner.json` path.
- Uses one bounded request/response implementation for lifecycle commands.

### `src/residency/protocol.ts`

- Exported the remove-actor command type for the generalized client.

### `src/providers/agents-provider.ts`

- Nested durable create uses `ResidentActorClient`.
- Added centralized local/remote actor resolution.
- `ask` now routes a remote actor absent from the local registry through its
  participant owner and the control plane.
- `tell` uses the same resolver while preserving its established unknown-target
  error contract.
- Remote ask/tell sends bindings only when an effective binding exists.
- Nested durable remove uses `ResidentActorClient`; root removal continues to
  use `ResidencyClient`.

### Build and tests

- Build entry changed from `recruitment-client.ts` to `actor-client.ts`.
- Added provider coverage for ask/tell when the actor exists only in the remote
  participant directory.
- Added concurrent nested durable recruitment coverage with distinct session
  files.

## Verification ledger

- `tsc --noEmit`: passed.
- Fabric build + artifact assertions: passed.
- `tests/agents-provider.test.ts`: 63/63 passed.
- `tests/residency.test.ts`: 8/8 passed.
- `git diff --check`: passed.
- Concurrent nested create integration: passed.
- Live cross-turn probe:
  - nested durable child creation: passed;
  - parent completed and resumed: passed;
  - resumed parent asked child: returned `PONG`;
  - resumed parent removed child: `{ removed: true }`;
  - probe cleanup: no actors remained.

## Upstream packaging plan

Prepare logical commits rather than submitting the full experimental worktree:

1. Resident lifecycle correctness: remove self-cede and fix canonical owner path.
2. Generalize resident actor lifecycle client (`createActor`, `removeActor`).
3. Centralize remote actor target resolution and fix ask/tell routing.
4. Add unit and cross-process regression tests.

## Full communication live probe

After reloading Pi, a fresh durable parent created a durable child, completed its
creation turn, and resumed independently for every operation:

- remote `status`: resolved the durable child through participant metadata;
- `tell`: mesh acknowledged; child completed a new run;
- `steer`: mesh acknowledged; child completed a new run;
- `followUp`: mesh acknowledged; child completed a new run;
- `ask`: child returned exactly `ASK_OK` after the prior turns;
- nested `remove`: returned `{ removed: true }`;
- `mesh.publish`: durable topic subscriber activated, retained the event across
  its next turn, and returned exactly `PUBLISH_OK`.

The child's message history advanced from 0 to 8 across the four communication
operations, with a distinct completed run for each one. Final actor registry was
empty. A cross-turn `stop` probe remains optional lifecycle coverage; it is not
a communication-path gap.

## Resident launcher shutdown fix — 2026-09-01

Local Fabric commit: `3d14aaa`

### Reproduction

KR 7.4 removed every durable actor and released `owner.json`, but the stable launcher
and its `pi --mode rpc` child remained alive for more than 30 minutes.

### Root cause

The resident host correctly reached its 30-second idle exit and released ownership.
The launcher deliberately kept the RPC child's stdin open. `ctx.shutdown()` completed
the extension but RPC mode continued waiting for stdin EOF, so the child and launcher
waited on each other. Duplicate startup losers could leak by the same mechanism.

### Fix

- Added `observeResidentOwner` as a small state transition helper.
- The launcher recognizes ownership only when `owner.pid` matches its child PID.
- When its owner disappears, the launcher ends child stdin to deliver RPC EOF.
- When another live owner wins startup, the duplicate launcher ends its child stdin.
- Stale/dead owner PIDs do not terminate a legitimate new startup.

### Verification

- TypeScript typecheck: passed.
- Focused launcher + residency tests: 12/12 passed.
- Build and startup-artifact assertions: passed.
- Live probe: durable actor self-removed in 4.884 seconds; after the 30-second idle
  window, actor registry was empty, `owner.json` was absent, and both launcher and RPC
  child were gone.
