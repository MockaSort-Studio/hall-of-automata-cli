# Armory suite inventory (initial)

Evidence-based inventory of Hall CLI/Pi Armory-relevant tooling as of Wave 1.
Aligned with `armory-env-lifecycle.md` and `microvm-armory-design.md`.

## Terminology

- **Base tool**: baked into every guest image and fixed spawn profile; never fetched at spawn.
- **Locker**: a lightweight index of suite manifests for one work domain.
- **Suite**: one self-contained capability manifest under a locker.
- **Operation**: one schema-bound capability granted or withheld per role.

```text
catalog index -> locker (work domain) -> suite (capability) -> operations
collaboration -> github              -> issue, pull request, discussion ops
```

## Base guest tools

- Shell and filesystem primitives are routed through each worker's own Gondolin guest
  (`worker-gondolin-extension.mjs`, `gondolin-worker-*.mjs`). They are Env-owned,
  not Armory-owned.
- `gh` is currently checksum-verified and cached through `armory-gh.mjs`, but the
  accepted design classifies it as a **base tool** to bake into the guest image.
  Wave 1B generalizes the underlying cache/verify/materialize mechanics; it does
  not change that classification.

## `collaboration/github`: first suite

`collaboration/github` is the first and only implemented suite. It is currently a
normal statically loaded Pi extension (`.pi/extensions/github/index.ts`), exposing
GitHub operations across core/repo, issues, pull requests, discussions, projects,
and labels.

It has dual execution delivery, resolved per call in `lib/core/gh.ts`:

1. **Guest-routed**: when the current worker has a Gondolin VM, `gh` runs through
   `execGhInGuest()` against the verified guest binary.
2. **Host-routed fallback**: Main or a process without an active guest uses the
   same operation implementation with host `gh`.

Both paths preserve the same `GithubError` behavior, as covered by
`tests/github-armory-routing.test.mjs`. Operation schemas and Pi registrations are
therefore shared regardless of execution environment. Pull-review self-review
protection remains independent of that routing.

## Proven versus designed-only

| Concept | Status |
| --- | --- |
| Shell/filesystem base tools | Implemented and Env-owned. |
| `gh` as a base guest tool | Accepted design; current code is still Armory-shaped. |
| `collaboration/github` | Static Pi extension with guest/host dual delivery. |
| Catalog/locker loader | Designed only; no generic manifest loader exists. |
| Sealed snapshots and sidecar restore | Designed only; Wave 1C scope. |

## Deferred suites

No second suite is implemented. `terraform` and `bazel` are illustrative future
candidates only; this inventory deliberately does not claim manifests, operations,
or policy for unimplemented suites.

## Sources

- `docs/crew/armory-env-lifecycle.md`
- `docs/crew/microvm-armory-design.md`
- `.pi/extensions/github/index.ts`
- `.pi/extensions/github/lib/core/gh.ts`
- `.pi/extensions/runtime/lib/armory-gh.mjs`
- `tests/github-armory-routing.test.mjs`
- `tests/runtime/armory-gh-resolver.test.mjs`
