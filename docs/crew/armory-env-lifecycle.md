# Armory and Env lifecycle

## Decision

Armory and Env are independent. Armory materializes verified suites into an
abstract filesystem; Env creates, restores, snapshots, and destroys isolated
environments. The per-worker lifecycle composes them during normal Crew agent
startup. There is no central factory, shared running VM, or Armory knowledge
of MicroVMs.

| Layer            | Owns                                                                                  | Does not know about   |
| ---------------- | ------------------------------------------------------------------------------------- | --------------------- |
| Armory           | catalog resolution, payload cache/verification, suite materialization, suite metadata | VM/QEMU lifecycle     |
| Env              | guest filesystem, isolation, boot/resume/snapshot/stop, sandbox execution boundary    | lockers, tool vendors |
| Worker lifecycle | profile selection, Armory/Env sequencing, host Pi tool registration                   | payload internals     |

Armory's target may be a VM filesystem, a container filesystem, or a test
directory. Its installation contract is independent of the target type.

## Catalog hierarchy

```text
catalog index -> locker (work domain) -> suite (capability) -> operations

infrastructure -> terraform -> fmt, validate, plan, apply
collaboration  -> github   -> issue, pull request, discussion operations
```

A locker is a lightweight index of suite manifests. A suite manifest is
self-contained: runtime payloads, install/probe rules, operation schemas, and
policy. There is no top-level artifact registry or operation-to-artifact
cross-reference graph. Payloads remain internal to their suite.

## Fixed spawn profile

Before an agent starts, Crew derives a fixed profile from:

```text
role + assigned domain + Crew-approved suites and operations
```

This profile is the sandbox allowlist. It does not widen during a worker's
lifetime. A role can receive only a suite projection, for example Terraform
`fmt`, `validate`, and `plan` for a tester, with `apply` included for an
integrator.

Two identities are kept separate:

```text
authorization digest = role + domain + permitted operation set
snapshot digest      = base image + installed suite manifest/payload digests
```

The authorization digest says what the worker may use. The snapshot digest
says what its guest filesystem already contains.

## Spawn and restore

```text
start worker
  -> derive fixed profile and snapshot key
  -> matching sealed snapshot: boot private VM with a private COW overlay
  -> snapshot miss: boot private provisioning environment
       -> Armory materializes the profile's suites into its filesystem
       -> lifecycle seals/publishes the immutable snapshot
       -> continue with that private environment
  -> rehydrate host Pi tool registrations from snapshot sidecar metadata
  -> agent starts work
```

A sealed snapshot contains guest tool bytes and a digest-verified sidecar
listing installed suites and their operation descriptors. Pi's tool registry
is host-process state, so it is not literally in the VM snapshot; worker
startup re-registers it automatically from that sidecar. This is invisible to
the agent and requires neither `/reload` nor an explicit load action.

Base tools are baked into the base image and covered by the profile allowlist.
Domain suites are provisioned before the snapshot is sealed. Once unrestricted
`bash` is removed or constrained, the fixed allowlist is the unambiguous guest
execution boundary.

## Concurrency and caching

Every worker has its own VM process, COW disk, workspace, credentials, and
agent process. Only immutable payloads and sealed snapshots are shared.

Concurrent workers resolve the same content-addressed cache keys. A lock is
used only while publishing a cache/snapshot entry (temporary path then atomic
rename); a worker never attaches to or waits indefinitely on another worker's
live VM. On a miss it can provision its own private environment.

Payloads, base images, and sealed snapshots are keyed by platform plus digest
and may be restored from local cache, GitHub Actions cache, then durable
origin. Actions cache eviction and per-repository scope are accepted: it is an
accelerant for continuous use, not durable state.

## Host portability

Env selects the available VM acceleration backend at runtime: `hvf` on macOS,
`kvm` on Linux when exposed, otherwise `tcg`. Cache hits avoid provisioning
work but do not make software-emulated runners fast; real CI runner classes
must be measured independently of local Apple Silicon results.
