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
- [~] Resolve a catalog channel once through Nix to its immutable Git revision,
  then derive suite flake locators from that revision, manifest path, closure,
  and output. The resolver/build primitive exists; worker profile wiring remains.
- [ ] Record the resolved catalog revision in each launched Crew worker profile.

## Current: Env guest-suite bridge

- [~] Replace legacy package/native installation with selected suite-flake outputs
  (immutable Nix acquisition primitive exists; lifecycle still uses legacy path).
- [x] Resolve each selected output's exact recursive Nix-store closure paths.
- [~] Mount only those paths read-only in its worker-local VM (mount plumbing
  is implemented for explicit worker Armory configuration; Crew wiring remains).
- [~] Add Env `describe`/`invoke` transport using typed request/result files and
  the guest `armory-suite` executable (generic bridge exists; lease wiring remains).
- [ ] Derive and verify runner authorization from the suite manifest and lease.
- [ ] Run the complete bundled GitHub runner inside Gondolin.

## Worker-local VM boundary

- [x] Keep VM ownership in the worker-local Pi runtime extension. Its Nix mount
  configuration is trusted runtime state, never model-visible tool data; it
  must not import suite modules or execute suite binaries on the host.
- [~] Have outer `worker.mjs` prepare immutable suite outputs before Pi starts,
  then pass only exact mount paths and approved operation grants into the
  worker-local runtime configuration (implemented for an explicit `armory`
  worker profile; Crew profile compilation does not supply it yet).

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
