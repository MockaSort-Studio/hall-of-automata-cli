# Armory suite inventory

Evidence-based inventory of Armory-related tooling in the staging repository.

## Catalog shape

```text
catalog -> locker -> packaged Pi extension suite -> tool registrations
armory/manifest.json
  collaboration/github/manifest.json
```

The outer catalog indexes package manifests only. Each packaged extension owns
one suite manifest; tools are selected from that manifest, not independently
resolved artifacts.

## Base guest tools

Shell and filesystem primitives are Env-owned and routed through each worker's
own Gondolin guest. `gh` is a future base guest tool, not a bespoke Armory
payload or guest-routing exception.

## `collaboration/github` (`pi-github-tools`)

The staged GitHub suite is represented at:

```text
armory/collaboration/github/
  package.json
  manifest.json
```

Its manifest records the `gh` system probe, version, verified cache fallback,
and the exact registered-tool allowlist. The normal extension source owns Pi
model-facing descriptions and schemas; Armory must not affect normal extension
installation.

During approved Crew sandbox construction only, the future loader will resolve
that suite's native requirement into the Env/snapshot and load the same package
with the profile's selected operations. Catalog loading, Env materialization,
snapshot sidecar restoration, and package extraction are not implemented yet.

## Status

| Concept                                       | Status                               |
| --------------------------------------------- | ------------------------------------ |
| Gondolin worker isolation                     | Implemented.                         |
| Generic cache/checksum primitives             | Implemented.                         |
| GitHub suite/package manifest staging layout  | Implemented.                         |
| Normal GitHub extension installation          | Unchanged and independent of Armory. |
| Sandbox profile-driven Armory loader          | Not implemented.                     |
| Sealed suite snapshot and sidecar restoration | Not implemented.                     |
| External `hall-armory` package repository     | Not created.                         |

## Sources

- `armory/manifest.json`
- `armory/collaboration/github/manifest.json`
- `armory/collaboration/github/src/index.ts`
- `docs/crew/armory-env-lifecycle.md`
- `docs/crew/microvm-armory-design.md`
