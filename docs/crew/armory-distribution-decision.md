# Armory suite distribution: decision record

Status: decided 2026-10-03. Revisit triggers are listed at the end.

## Problem

A Crew worker runs in a Linux Gondolin VM whose CPU architecture matches the
host (QEMU only accelerates a matching guest). Armory suites are therefore Linux
closures: `x86_64-linux` (Linux, Intel Macs) and `aarch64-linux` (Apple silicon).
A Mac cannot build them (no Linux builder), and evaluating the suite flake
downloads nixpkgs (about 1 GB of store). Distribution must be cross-OS, fast,
and light, and a missing artifact must degrade to a host-only Crew, never fail.

## Scope principle

Armory ships the lightest closure that makes a tool functional, relative to the
guest baseline (Alpine/musl, Node 24, `sh`, `curl`, pinned by the Gondolin
version). What the tool does at runtime (workspaces, downloads, caches, network)
is the tool's and the guest policy's concern, not distribution's. Suites are
sized by what the guest lacks, nothing more.

## Options considered

| Option | Verdict |
| --- | --- |
| **A. Nix on the client, CI-built Linux closures in a Cachix binary cache** | **Chosen** |
| B. CI-built closure tarballs (sha256 in the catalog), no Nix on the client | Deferred; clean second step |
| C. FlakeHub Cache | Rejected: paid plans only; pulling needs `determinate-nixd login` |
| D. Local Linux builder on every Mac | Rejected: sudo setup, GBs of disk, slow first build |
| E. Host-only Crews | Kept as the automatic fallback, not the product |

## Why Nix won (A)

- It is the mechanism already built and tested: catalog resolves a channel to an
  immutable revision, suites are flake outputs, closures are exact store paths
  mounted read-only through the filtered `/nix/store` provider.
- The suite flake is pinned, so output paths are identical on every machine. CI
  builds once per system; clients substitute and never build (about 30 s CI
  builds, and no client builder).
- Nix deduplicates shared closure pieces (node, gh) across suites and fetches
  only missing paths. Tarballs would re-ship them per suite.
- Signature and key verification come from Nix; B would make us own that trust
  model (catalog hashes and attestations).
- A local build remains possible when an artifact is missing or a suite author is
  iterating, which B cannot offer.
- The user accepted one-time client setup in exchange for the above.

## Cost of A, stated plainly

- Each machine needs Nix and one cache entry, which needs root once.
- This install's `trusted-users` is only `root`, so a client cannot add a
  substituter per call. The cache must be in `extra-substituters` and
  `extra-trusted-public-keys`.
- Pulling the first time costs a download of the runtime closure only (build
  tools are not fetched). Closure size is still to be measured.
- Windows has no native Nix. Windows hosts take the host fallback (WSL2 is fine).

## Bootstrap options researched

| Option | Result |
| --- | --- |
| Determinate installer | One command, needs root (creates the `/nix` volume on macOS). Chosen. |
| `nix-portable` | Rootless and zero-config, but Linux only; explicitly no macOS support. Possible rootless fallback on Linux; not validated with this repo. |
| FlakeHub Cache | Already trusted by Determinate installs, but paid and needs login. Rejected. |
| Per-call `--option extra-substituters` | Ignored for untrusted users. Making the user trusted is effectively root equivalence; rejected. |
| Run Nix inside a Gondolin guest | Would remove host Nix, but is unvalidated (guest Nix availability, network policy, persisting the store to the host). A spike, not a plan. |
| Tarball artifacts (B) | Removes Nix from the client entirely; see revisit triggers. |

macOS cannot avoid one elevated step: the `/nix` volume requires root. The
practical minimum is therefore one command and one password prompt, which
`scripts/setup-env.sh` provides: it installs Nix if missing, adds the Armory
cache to `/etc/nix/nix.custom.conf`, restarts the daemon, and verifies. It never
runs implicitly; the Crew only reports it (preflight message, host fallback).

## Assessment: Nix inside a Gondolin guest

Not an anti-pattern: a Linux VM running Nix to realize Linux closures is how
macOS Nix already works (`darwin.linux-builder`, Determinate's native Linux
builder). Our variant would only fetch from the cache into a host directory,
never build, so the host needs no Nix, no root, and no client config (we are
root inside the VM and set the substituters there).

It is probably overkill for us. It trades a one-time install for a permanent
moving part: a guest image with a static Nix, guest network policy for the cache
hosts, a writable host mount that preserves symlinks, executable bits, and the
Nix database, a VM boot on every cache miss, and harder debugging. Tarballs
(option B) remove Nix from the client with less machinery and need only a CI
export step plus catalog fields. Choose Nix-in-a-guest only if we want to keep
Nix semantics (deduplication, signatures, local builds) without a host install,
and then after a measured spike, not before.

## Cache policy

- Only CI pushes (hall-armory `packages.yml`, per affected suite, after tests,
  `main` only). Pull requests build without credentials or upload.
- The token should live in a GitHub Environment restricted to `main`, so a
  writer's branch cannot use it to publish artifacts clients would trust.
- Warming is unnecessary for correctness: pinned store paths never change.
  Run `cache-sync.yml` manually after cache cleanup or a retention change.
- Cache: `https://hall-armory.cachix.org`, key
  `hall-armory.cachix.org-1:xKu3F2f2lHnVSl9gyFi5Fsk2rs724sILlfdEIHWjWrc=`.

## Measurements (2026-10-03, Apple silicon, `aarch64-linux` guest)

- CI: each system builds in about 30 s. The fetch-only verify (`--max-jobs 0`)
  passes on Ubuntu and on a macOS runner, so Macs substitute without a builder.
- Cold-start profile (Apple silicon, empty store, a slow network that day, so
  read ratios, not seconds; an earlier faster run took 3 min in total):

  | Phase | Time | Store growth |
  | --- | --- | --- |
  | Resolve the catalog (`flake metadata`) | 3 s | 0 |
  | Evaluate the suite flake | 716 s | +341 MB (nixpkgs source, 209 MB archive) |
  | Fetch the closure (67 paths, 86 MiB download) | 1278 s | +352 MB |

  Peak 848 MB = Nix install 155 + nixpkgs source 341 + closure 352. Evaluation is
  about a third of the time and half of the disk growth, and none of it is
  needed to run the suite. The nixpkgs source is an unrooted store path, so a
  later collection removes it and every cold start fetches it again.
- Nearly all closure paths come from cache.nixos.org (node, glibc, gh, libraries);
  the Armory cache supplies only the small runner and wrapper.
- Client, warm: 1.4 s. Each closure is rooted by `--out-link` under
  `~/.cache/hall/armory/roots/<suite>-<system>` (a newer revision overwrites
  the link). The link must be created in place; moving it unregisters the root.
- The closure is larger than the work needs: it ships Node 24.20 (nodejs-slim
  90 MB), glibc 47, icu 42, bash and several `-dev` outputs (headers) because
  the wrapper script and nixpkgs `gh` pull them in. The Gondolin guest image
  already provides Alpine (musl) with Node v24.14.1, `sh` and `curl`; it lacks
  `gh`. A closure of the runner bundle plus a static `gh` would be about 45 MB.
- Building instead would need the same runtime plus build tools (a CI verify log
  showed 126 paths, 260 MiB download and 802 MiB unpacked) and a compile.

## Revisit triggers (move to B, tarballs)

- Several suites make duplicated downloads or disk use material.
- Install friction blocks adoption, or Windows-native hosts matter.
- Cachix retention or limits become a recurring operational cost.

B is additive: CI keeps `nix build`, adds a deterministic closure export, and the
client points the filtered-store provider at an extracted directory (its backend
is already injectable). Nix would remain as the dev and fallback path.
