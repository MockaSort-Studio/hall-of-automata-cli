# Armory and Env lifecycle

## Boundary

Crew dispatches Pi subagents. Pi's subagent runtime remains unchanged. Env is
the generic bridge from Crew's assembled tool grants to a private guest; Armory
resolves immutable suite identities. Neither Armory nor installable Pi packages
own Crew scheduling or VM mechanics.

| Layer | Owns | Does not know about |
| --- | --- | --- |
| Crew | actor assembly, role/roster policy, dispatch narrowing | closure internals, VM mechanics |
| Armory | catalog, package/suite identity, Nix closure descriptors | workers, QEMU, mounted workspaces |
| Env | artifacts, mounts, VM lifecycle, sidecars, guest execution | vendors and role names |
| Pi package | schemas and operations over injected transport | Crew, Env, Nix, Gondolin |

## Derive the fixed profile

`actor.tools`, assembled by Crew from `roles.json` and `roster.json`, is the
source of truth. Crew classifies it into Pi built-ins, Crew/Comm tools, and
Armory operations. It groups Armory operations by suite and passes the result
to Env before the Pi subagent starts work.

```text
actor.tools
  -> builtin operations: routed by Env to the VM
  -> internal operations: stay in Crew/Comm
  -> suite operations: resolved by Armory and activated by Env
```

The profile is fixed for the worker lifetime. Dispatch can narrow the role and
roster grant but cannot widen it.

Keep two identities separate:

```text
authorization digest = final permitted tool/operation set
physical profile digest = platform + base + canonical suite-layer digests
```

The first controls registration and execution. The second controls artifact
and warm-snapshot reuse. Neither includes worker name or repository identity.

## Suite activation

A suite binds its Pi package and native closure as one compatibility unit:

```text
package identity + extension bundle + Nix closure + named entrypoints
+ operation allowlist + probes + policy
```

Nix closures supersede archive/download native fallback metadata. Env receives
named bindings, such as `githubCli`, to an exact guest entrypoint. An
installable package receives an abstract command transport; it does not resolve
an ambient binary or contain environment-specific routing.

```text
package operation -> transport.run("githubCli", argv)
                  -> Env allowlist -> private VM exact guest command
```

## Acquire and run

```text
Crew prepares actor
  -> compile final actor.tools profile
  -> Armory resolves selected suites and closure identities
  -> Env verifies/fetches immutable layers
  -> Env creates one private Gondolin VM and mounts layers read-only
  -> Env mounts the worker workspace privately
  -> Env supplies bindings to package operation factories
  -> Pi subagent runs with only the profile's registered operations
```

The guest base is a small Gondolin root plus mandatory base layers, currently
`gh`. Domain layers such as Terraform, uv, or Bazel are attached only when a
selected suite needs them. No domain toolchain is required on the host or in a
repository devcontainer.

## Cache and snapshot model

Nix-built layers are immutable, content-addressed, mountable artifacts. They
are fetched from local cache, CI cache, then durable Armory origin. CI cache is
an accelerant; its eviction is accepted.

Each worker gets a distinct VM and COW overlay. A sealed snapshot stores only
root/mutable preparation state and a sidecar pinning layer digests and bindings.
On restore Env verifies and reattaches layers, then creates a new private COW
VM. Workspaces, credentials, and live processes are never shared.

Warm snapshots are an LRU-like performance cache for measured, frequent
canonical layer sets. They are not a package registry and do not require every
role/domain permutation to be prebuilt.

## Credentials

Credentials are injected only into live execution through Gondolin's controlled
network/secret mechanism. They do not appear in Nix closures, layer manifests,
snapshot disks, or sidecars.

## First vertical slice

1. Compile a Crew actor's existing `tools` into a profile.
2. Resolve the GitHub suite and its Nix `gh` base layer.
3. Mount that layer in the worker's private VM.
4. Register the requested GitHub operation projection through Env's injected
   guest transport.
5. Prove two Crew-dispatched Pi subagents use different VM/workspace overlays
   and no host `gh` binary.
6. Add Terraform through the same contracts.
