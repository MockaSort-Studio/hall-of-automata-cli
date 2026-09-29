# Armory suite inventory

Hall Armory owns catalog manifests and suite source. Hall CLI owns Crew, Env,
and the generic host proxy. An Armory suite is a guest execution artifact, not
a host Pi extension.

## Suite shape

```text
suite source + manifest + locked Nix flake
  -> guest extension implementation/runner
  -> guest dependencies
  -> native tool closures
  -> operation descriptors
```

The host Pi worker receives only approved descriptors and generic proxy
closures. It does not import the suite implementation or native binary.

## GitHub

`collaboration/github` currently has a locked Nix flake that builds `gh` 2.101
for Linux and a released extension package. The Nix closure mounts and executes
in Gondolin successfully. The flake does not yet build the complete guest
GitHub extension runner; therefore it is not yet an Env-activated suite.

`gh` is not bytes in the Gondolin root image. It is an immutable Nix closure
mounted only for worker profiles that select the GitHub suite.

## Status

| Capability | Status |
| --- | --- |
| Crew `actor.tools` profile record | Implemented |
| Hall Armory locked Nix suite flake | Implemented for GitHub `gh` |
| Nix closure build, exact-path mount, guest `gh` smoke | Proven locally |
| Host npm/package cache for Env | Explicitly rejected |
| Guest suite runner/descriptor protocol | Not implemented |
| Nix-built guest extension bundle/dependencies | Not implemented |
| Per-worker generic Pi proxy registration | Not implemented |
| Crew end-to-end guest suite invocation | Not implemented |
| VM snapshot cache | Deferred |

See `microvm-armory-design.md` for the canonical model.
