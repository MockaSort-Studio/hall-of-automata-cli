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

## Blocker: immutable suite source identity

- [ ] Add an immutable, reviewable Nix flake locator to each suite/catalog
  release record (for example a Git revision plus suite-root directory and
  selected output). A relative `native.closure` alone cannot be built by Env
  after catalog resolution without inferring mutable `main` source.
- [ ] Pin the catalog/release record that supplies that locator before Env
  builds it. Do not infer or fetch an unpinned source from a raw catalog URL.

## Current: Env guest-suite bridge

- [ ] Replace legacy package/native installation with selected suite-flake outputs.
- [ ] Resolve each selected output's exact recursive Nix-store closure paths.
- [ ] Mount only those paths read-only in its leased worker VM.
- [~] Add Env `describe`/`invoke` transport using typed request/result files and
  the guest `armory-suite` executable (generic bridge exists; lease wiring remains).
- [ ] Derive and verify runner authorization from the suite manifest and lease.
- [ ] Run the complete bundled GitHub runner inside Gondolin.

## Then: host proxy and lifecycle

- [ ] Implement a generic Pi proxy holding only approved descriptor metadata and
  an Env lease handle; it must never import suite code.
- [ ] Register only guest-described, approved operations in the worker Pi
  subprocess that owns the lease.
- [ ] Acquire the lease and describe operations before starting that worker Pi.
- [ ] Release VM/lease state through worker lifecycle cleanup.
- [ ] Remove/rework legacy host GitHub activation and Env package-cache/guest
  installer paths from Crew execution.

## Acceptance proof

- [ ] Run two GitHub-enabled Crew workers end to end.
- [ ] Prove isolated Pi sessions, VMs/COW workspaces, and credentials.
- [ ] Prove only immutable selected Nix paths are shared.
- [ ] Prove neither host `gh` nor host Armory implementation executes.
- [ ] Add Terraform through the same flake/runner/proxy contract.

## Deferred

- [ ] Snapshot/profile-cache optimization after the base Nix-mount vertical slice.
