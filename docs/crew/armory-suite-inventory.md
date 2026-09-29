# Armory suite inventory

This inventory describes the target catalog boundary. Catalog manifests and
releasable suite packages live in `MockaSort-Studio/hall-armory`; Hall CLI
retains only Crew, Env, and generic runtime integration.

## Catalog shape

```text
catalog -> locker -> suite -> operation projection

collaboration -> github -> issue / pull request / discussion operations
infrastructure -> terraform -> fmt / validate / plan / apply
```

A suite is not a binary lookup. It is an atomic compatibility declaration:

```text
Pi package identity + extension bundle + Nix closure identity
+ named guest entrypoints + operation allowlist + probe/policy
```

Nix closures supersede system-probe/archive-fallback native metadata. Nix
builds/fetches the closure; Env mounts its verified immutable layer in a
private worker guest.

## Base and GitHub

`gh` is mandatory base infrastructure. It is represented as a pinned Nix
closure layer mounted in every guest, not copied into the Gondolin root disk.
The GitHub Pi package is activated only when Crew's assembled `actor.tools`
selects GitHub operations.

The package must expose operation factories over an injected transport. Env
binds that transport to the exact guest `gh` entrypoint. The package does not
know Nix, Gondolin, Armory, Crew, or snapshot paths.

## Status

| Capability | Status |
| --- | --- |
| Gondolin worker isolation and built-in tool routing | Implemented |
| Pi Node 24 + Gondolin 0.12 checkpoint/COW smoke | Proven on local x86 |
| Nix `gh` closure mounted read-only in guest | Spike proven |
| Closure layer sidecar/activation contract | Design next |
| Crew `actor.tools` profile compiler | Not implemented |
| Generic Env transport injection | Not implemented |
| Hall Armory Nix closure manifests/artifact publishing | Not implemented |
| GitHub operation through Env guest transport | Not implemented |

See `armory-env-lifecycle.md` for the canonical launch and ownership model.
