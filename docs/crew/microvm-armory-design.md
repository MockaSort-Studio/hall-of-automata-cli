# MicroVM + Armory design

## Decision

Crew dispatch is the sole entrypoint. Crew is built on Pi's subagent runtime;
Env does not create a second agent model or a second Pi RPC topology. Each Pi
subagent stays host-side. Env gives its registered tools one private Gondolin
VM and routes approved native operations into that VM.

```text
Crew dispatch -> Pi subagent -> Env lease -> private Gondolin VM
                                    |              |
                                    |              +-- workspace COW overlay
                                    +-- Armory layers (read-only)
```

A guest is a disposable execution environment, not a repository devcontainer
and not an image per automaton.

## Profile source of truth

Crew already assembles `actor.tools` from `roles.json` and `roster.json`.
That final tool set is the only input to profile compilation:

```text
role baseline tools + automaton roster tools - dispatch narrowing
```

`roles.json` defines reusable functional capabilities. `roster.json` defines
an automaton's domain additions. Dispatch may narrow the result for a bounded
task, never widen it beyond those declarations.

Crew compiles tool names into three classes:

| Class | Example | Handling |
| --- | --- | --- |
| Pi built-in | `read`, `bash`, `edit` | Env routes operations to the worker VM |
| Crew internal | `comm_notify` | Host Crew/Comm only |
| Armory operation | `github_pull_request_view` | Group by suite and activate through Env |

Thus a profile is derived, not separately requested:

```json
{
  "builtins": ["read", "bash", "edit"],
  "suites": [{ "suite": "collaboration/github", "operations": ["github_pull_request_view"] }]
}
```

## Suite and layer model

An Armory suite is an atomic compatibility unit:

```text
Pi package identity + extension bundle + Nix closure identity
+ executable bindings + operation allowlist + probe/policy
```

Nix closures replace URL/archive native-binary fallback metadata. A suite pins
Nix inputs, platform output/closure identity, and named entrypoints. A package
never searches ambient `PATH` for the companion binary.

`gh` is mandatory base infrastructure. It is logically part of every guest
base, but physically a read-only Nix closure layer rather than bytes copied
into the small Gondolin root disk. GitHub operations are activated only for
profiles that select them.

```text
small Gondolin root disk
+ base gh closure layer
+ selected domain closure layers
+ private VM COW overlay
+ private workspace overlay
```

The current root disk has about 79 MiB free; the tested Nix `gh` closure is
about 84 MiB. Keeping closures as layers prevents root-image growth.

## Env adapter boundary

Env is the only Armory-to-guest adapter. It owns artifact acquisition, mounts,
private VM lifecycle, guest command routing, sidecars, and snapshot reuse.
Armory owns catalog and suite identity. Crew owns dispatch and policy.

Env returns a lease with verified named bindings, conceptually:

```text
lease.execute("githubCli", argv) -> worker VM exec(exact guest gh path, argv)
```

Installable Pi packages contain operation schemas and implementation over a
small injected command-transport interface. Standalone loading may provide a
local transport. Env provides the guest transport. Packages must not import or
name Crew, Armory, Gondolin, Nix, snapshot paths, or environment variables.

## Immutable artifacts and snapshots

The artifact cache stores mountable, content-addressed closure layers. A layer
contains Nix store paths plus a manifest that identifies its output, closure,
platform, and entrypoints. It has no credentials.

A sealed snapshot stores only mutable/root-disk preparation state. Its sidecar
pins required layer digests and command bindings. Restore verifies and
reattaches those immutable layers before creating a fresh private COW VM.
The repository workspace and credentials are never reusable snapshot content.

Snapshots are optional hot-profile caches, keyed by platform, base version,
and canonical selected suite-layer digests -- never by role name, automaton,
or repository. Promote measured frequent profiles and evict cold composites.
A snapshot miss remains correct because Env can reattach verified layers.

## Secrets and isolation

Every worker gets a separate QEMU process, COW disk, workspace overlay, and
credentials/session. No running VM is shared. GitHub credentials are supplied
only at runtime through Gondolin's proxy/placeholders; neither closure layers
nor snapshot disks contain credentials.

## Evidence

On Linux x86 with Pi Node 24 and Gondolin 0.12, programmatic QEMU checkpoint,
resume, and private COW behavior pass. A Nix `gh` spike proved a read-only
closure layer runs at its exact `/nix/store/.../bin/gh` path and can be
reattached after checkpoint restore. The root snapshot remained about 2.5 MiB
while the `gh` layer was about 84 MiB.

## Delivery plan

1. Define profile, suite-activation, layer, binding, sidecar, and Env lease
   contracts from assembled `actor.tools`.
2. Change Hall Armory manifests from archive fallbacks to pinned Nix closure
   descriptors and publish mountable closure layers.
3. Implement Env's layer cache, Gondolin mounts, and allowlisted guest command
   executor; wire it into Crew's existing worker launch path.
4. Give packages a generic injected transport factory; implement the GitHub
   vertical slice with guest `gh` and no host `gh` requirement.
5. Prove two Crew subagents receive separate VM/workspace overlays from one
   `gh` base layer, including runtime-only credentials.
6. Add Terraform as the second suite without new lifecycle machinery.
