# Armory implementation todo

This is the live implementation ledger. Update its state with every completed
or partially completed milestone; `[~]` means implementation exists but is not
wired through the worker lifecycle.

## Complete

- [x] Document host Crew/Pi, Env proxy, and guest-suite execution boundaries.
- [x] Define Nix as the sole Armory materializer and artifact cache.
- [x] Compile fixed worker `actor.tools` profiles from roles and roster.
- [x] Prove Gondolin isolation/COW and exact read-only Nix `gh` closure mounts.
- [x] Build the GitHub guest suite with locked Nix inputs, runner, extension
  implementation, Node, and `gh`.
- [x] Keep Nix/runner inputs out of the standard Pi npm package.
- [x] Define and smoke-test guest-runner `describe`/`invoke` behavior.

## Immutable suite source identity

- [x] Add explicit `native.output` to suite manifests and a root Armory flake.
- [x] Resolve a catalog channel once through Nix to its immutable Git revision,
  then derive suite flake locators from that revision, manifest path, closure,
  and output.
- [x] Record the resolved catalog revision in each launched Armory worker
  configuration before Pi starts.

## Current: Env guest-suite bridge

- [x] Prepare selected worker suite-flake outputs through Nix; the active
  worker path does not use npm package/native installation.
- [x] Resolve each selected output's exact recursive Nix-store closure paths.
- [x] Mount only those paths read-only in its worker-local VM using one
  security-reviewed filtered `/nix/store` provider that exposes exactly the
  selected closure entries.
- [x] Add guest `describe`/`invoke` transport using typed request/result files
  and the guest `armory-suite` executable.
- [x] Derive and verify runner authorization from the suite manifest, final
  worker grants, and guest-described operation projection.
- [x] Run the complete bundled GitHub runner inside Gondolin using the filtered
  single-store provider; `describe` returned the approved GitHub operation.

## Worker-local VM boundary

- [x] Keep VM ownership in the worker-local Pi runtime extension. Its Nix mount
  configuration is trusted runtime state, never model-visible tool data; it
  must not import suite modules or execute suite binaries on the host.
- [x] Have outer `worker.mjs` prepare immutable suite outputs before Pi starts,
  then pass only exact mount paths and approved operation grants into the
  worker-local runtime configuration.

## Then: host proxy and lifecycle

- [x] Implement a generic Pi proxy holding only approved descriptor metadata and
  a guest-runner handle; it never imports suite code.
- [x] Register only guest-described, approved operations in the worker Pi
  subprocess that owns the VM; a real Pi worker-session smoke passed.
- [x] Acquire immutable suite outputs and describe operations before starting
  that worker Pi; a full `worker.mjs` smoke passed.
- [ ] Release VM/lease state through worker lifecycle cleanup.
- [ ] Remove/rework legacy host GitHub activation and Env package-cache/guest
  installer paths from Crew execution.

## Acceptance proof

- [~] Run two GitHub-enabled workers end to end (worker-level smoke passed;
  full Crew SDK launch remains).
- [x] Prove isolated Pi sessions and VMs/COW workspaces; guest credential
  injection supplies host-held secrets only as Gondolin placeholders.
- [x] Prove only immutable selected Nix paths are shared (two workers resolved
  the same suite root and exact closure path set).
- [ ] Prove neither host `gh` nor host Armory implementation executes.
- [x] Test filtered-store denial for unrelated paths, traversal, readdir,
  `stat`/`access`, and symlink/realpath escape; worker-to-worker and Main
  session proxy isolation passed.
## Deferred

- [ ] Add Terraform through the same flake/runner/proxy contract after GitHub
  acceptance is complete.

- [x] Investigate Gondolin layering/checkpoints; see
  `gondolin-overlay-investigation.md`.
- [ ] Snapshot/profile-cache optimization after the base Nix-mount vertical slice.
