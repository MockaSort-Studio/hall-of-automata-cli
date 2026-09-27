# MicroVM + Armory design

## Purpose

Run Pi agents in a small, disposable Gondolin guest while granting specialized
native Pi tools through cacheable, digest-pinned Armory artifacts. The guest is
an isolation boundary, not a project environment image.

## Two independent concerns

Env and Armory do not know about each other's internals. Conflating them was
a real mistake in the first `gh` implementation (a single file that both
resolved a tool identity and drove VM mechanics directly), and made the
pattern impossible to generalize to a second tool without copying it.

| Layer      | Owns                                                             | Does not know about                        |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------ |
| **Env**    | VM boot, backing disk, checkpoint/resume, guest filesystem       | any specific tool (`gh`, `terraform`, ...) |
| **Armory** | catalog: tool -> digest, fetch source, guest requirement, policy | QEMU, VM lifecycle, checkpoint mechanics   |

Env must be host-OS-agnostic. Local development here happens to be on Apple
Silicon, but Linux is the realistic target for scaled/CI usage, and the two
need different acceleration backends (`hvf` on macOS, `kvm` on Linux where
exposed, `tcg` software-emulation fallback otherwise). The acceleration
backend is selected per host at VM-create time, never hardcoded to one
platform's value.

## Lifecycle contract

The detailed Armory/Env boundary, fixed spawn profile, snapshot sidecar, and
per-worker provisioning/restore flow are specified in
[`armory-env-lifecycle.md`](armory-env-lifecycle.md). In short: base tools are
baked into the base image; Crew selects domain suites before spawn; Armory
materializes them into an abstract filesystem; and the worker lifecycle seals
and restores the resulting environment without exposing a reload step to the
agent.

## Model

```text
Pi host
  ├─ routes built-in file/shell tools to one Gondolin guest per agent session
  └─ Armory loader, invoked by domain, not wired per-tool at extension load
       ├─ reads the catalog manifest for that domain
       ├─ registers that domain's Pi tools live (pi.registerTool(), no reload)
       └─ resolves, verifies, and invokes guest-only tool payloads

Armory catalog entry (per domain, not per file)
  ├─ Pi tool schemas the loader registers
  ├─ manifest: guest platform, digest, authority, resource/network policy
  ├─ guest payload: binary or complete toolchain closure
  └─ setup/probe contract
```

The host-side adapter never executes the specialized binary. It exposes a
verified payload to the guest and uses the VM execution API to invoke it.

## Artifact resolution

For an allowed tool invocation, resolve the exact artifact digest:

```text
1. A provided toolchain matches the artifact's required identity -> use it.
2. Exact payload exists in the local Armory cache -> use it.
3. Restore that cache path from GitHub Actions cache -> use it.
4. Fetch from the durable central Armory source -> verify and prepare it.
5. On a successful Actions job, save the prepared cache path.
```

A version string alone is not a match; the artifact defines the identity to
verify. Cache entries hold no secrets.

```text
~/.cache/hall/armory/<guest-platform>/<artifact-digest>/
```

Base guest images, Armory tool payloads, and installed-domain disk
checkpoints are all the same shape from a caching point of view: immutable
blobs keyed by platform + digest. All three resolve through the same order
above, restore from the same cache tiers, and get saved back the same way.

GitHub Actions cache is an accelerant and may evict entries; that is
accepted, not worked around. This system is meant for continuous use, so an
inactivity-based eviction window is the right behavior, not a gap to patch.
Cache scope is per-repo/branch (with base-branch fallback); that is also
accepted -- each repository's Crew runs stay independent, with no cross-repo
or cross-team shared cache requirement. Central Armory (GHCR, release
assets, or a future service) remains the durable source cache restores fall
back to.

Cache hit/miss is a separate axis from boot/exec speed. A cache hit still
boots through whatever acceleration backend the runner actually exposes
(see "Two independent concerns" above); on a runner without KVM/HVF, that is
software-emulated QEMU (`tcg`), which is meaningfully slower than the
hardware-accelerated numbers measured below, not just "a bit slower."
Verify actual boot/exec cost on the real target runner class before relying
on local-hardware numbers for any CI-facing decision.

## Boundaries

| Owns                  | Responsibility                                                  |
| --------------------- | --------------------------------------------------------------- |
| Minimal guest         | isolation, disposable workspace, base shell/executor            |
| Armory artifact       | executable/toolchain, Pi UX, digest, setup/probe, policy        |
| Project configuration | arguments, repository config, input paths, build-cache settings |
| Build cache           | project outputs; separate from immutable tool payloads          |

An artifact may own a complete toolchain (for example Bazel plus JDK), but the
base guest never accumulates it permanently.

## VM sharing model: shared backing disk, one process per worker

Each Crew worker gets its own Gondolin VM process and its own kernel boot.
That boundary is not up for negotiation: it is what makes one worker's shell
commands unable to observe or corrupt another's.

A single already-running VM cannot safely take on a second isolated tenant.
A qcow2 overlay is a disk branch point evaluated at `VM.create()`/`resume()`
time; it selects what a _new_ VM boots from. It is not a live operation that
grafts a fresh writable layer onto an already-running kernel. The only way to
put multiple tenants on one already-booted kernel is guest-side containers
(namespaces/cgroups), which would make the guest kernel the isolation
boundary instead of the VM -- the same blast radius as unsandboxed host
namespaces, for the actor (an LLM-driven agent running arbitrary shell
commands) we most want isolated. Confirmed against Gondolin's actual
primitives: `gondolin attach <session-id>` shares one kernel's filesystem and
process view across shells: multi-session, not multi-tenant.

What _is_ shared, safely, is the immutable backing disk:

```text
one shared, read-only backing image (kernel + rootfs [+ future Armory payloads])
  ├─ worker A: own QEMU process, own COW overlay, own boot
  ├─ worker B: own QEMU process, own COW overlay, own boot
  └─ worker C: own QEMU process, own COW overlay, own boot
```

Every worker still boots its own kernel; only the read-only base layer is
shared, so writes never leak between workers. Today the base image is plain
kernel+rootfs, so this mainly dedupes the ~300MB local image cache. It
becomes the mechanism that matters once a real domain suite is installed via
the checkpoint flow (see First implementation, step 3): all workers resume
from one checked-in image that already has the payload installed, instead of
each worker re-provisioning it independently.

Measured on this host (Apple Silicon, hardware-accelerated QEMU, 3 concurrent
workers) -- see "Two independent concerns" above for why this is not assumed
to hold on a Linux CI runner without verifying its acceleration backend:

| Metric                            | Value |
| --------------------------------- | ----- |
| Solo VM boot to first guest exec  | ~1.2s |
| 3 concurrent VM boots, wall clock | ~2.1s |
| Same 3 boots, serial sum          | ~5.6s |

Concurrent workers already boot as independent OS processes. The future cost
worth solving is payload provisioning/download duplication, not serialized
boot.

## Capability, policy, and large artifacts

Armory grants explicit tools, not ambient host executables. Suite manifests
declare platform, authority, resources, network, and secret requirements;
payloads are immutable and digest-verified. Large toolchains may use
independently cached content-addressed components, while project build caches
remain separate. Promote only measured expensive profiles to a sealed
snapshot; do not pre-load every suite into the base guest.

## First implementation

1. [DONE] Integrate one minimal Gondolin VM with Crew worker dispatch. Route
   each worker's built-in file/shell tools and user shell commands to its own
   guest. Proven end-to-end through the real `start_crew` path: `environment:
{ microvm: "auto" }` resolves and threads `sandbox` per launch, a real QEMU
   VM boots (kernel/initrd from the Pi cache), `bash`/`read` route into the
   guest, `.env`/`.npmrc` stay hidden, guest writes are visible to the host,
   and the VM/process tear down cleanly on completion. Two platform bugs
   found and fixed along the way (a Comm-registration race and a stale-`pi`-
   after-reload crash) are recorded in `docs/crew/follow-ups.md`; they affect
   every ordinary Crew worker, not only sandboxed ones.
2. [DONE, needs reclassification] A working `gh` guest-only routing PoC
   exists and is correct on its own terms (checksum-verified, argv-exec,
   `getActiveGondolinVm()`-driven, no `/reload` to notice a new VM). What it
   is not yet is a generalized Armory artifact: it is one bespoke file that
   both resolves `gh`'s identity and drives guest install directly, and it
   treats `gh` as a fetched/verified domain payload rather than what it
   actually is here -- a base tool that belongs baked into the guest image.
   Reclassify `gh` as a base tool, and use it as the worked example when
   building the actual generalized artifact/catalog contract (schema,
   digest rules, and the generic domain-suite loader from "Tool tiers"
   above) -- specified separately.
3. [NEXT] Build one real non-base domain suite (for example `terraform` or
   `bazel`) through the generalized catalog and fixed spawn-profile flow.
   Materialize it once before sealing; on a second worker, restore both the
   guest bytes and host Pi operation registrations from its snapshot sidecar
   without reload. Measure VM-ready, snapshot restore, first vs. repeat
   invocation, RAM, and snapshot size on both a local hardware-accelerated
   host and a real target CI runner.
