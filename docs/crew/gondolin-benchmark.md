# Gondolin benchmark and design assessment

Measured 2026-10-04 on one machine: Apple M1, 8 GiB RAM (about 2 GiB free), 8 cores,
QEMU with Hypervisor.framework acceleration, `@earendil-works/gondolin` 0.12.0. Single
runs or small samples; treat differences under about 20% as noise. Summed RSS
double-counts shared pages, so memory is an upper bound.

Reproduce: `node scripts/bench/crew-scale.mjs <none|gondolin|armory> <N>` (launch cost,
no model calls) and `node scripts/bench/gondolin-vm.mjs` (VM and Armory path costs).

## Model usage

Same trivial task (notify Main, mark complete) on one worker, host versus Gondolin with
the Armory GitHub suite granted:

| | Host | Gondolin + Armory |
| --- | --- | --- |
| Static context (system prompt + tool schemas) | 840 + 599 = 1,439 tokens | 785 + 641 = 1,426 tokens |
| Turns / tool calls | 3 / 2 | 3 / 2 |
| Total tokens | 14,497 | 14,744 (+1.7%) |
| Cost | $0.0160 | $0.0164 (+2.5%) |

The granted `github_issue_view` schema is about 40 tokens. Isolation adds no turns, so
**model cost is not a factor**. A real `github_issue_view` call took 0.88 s end to end.

## Time

| Step | Cost |
| --- | --- |
| Worker ready, host (1 / 2 / 4 workers) | 0.95 / 1.1 / 1.6 s |
| Worker ready, Gondolin, no suite (1 / 2 / 4) | 1.9 / 1.8 / 3.0 s |
| Worker ready, Gondolin + Armory (1 / 2) | 2.1 / 3.3 s |
| VM boot (first exec), alone | 0.8-0.95 s (1.6 s under load) |
| VM boots, 2 / 4 concurrent, wall | 1.1 / 2.0 s |
| Exec in a booted VM | about 2 ms |
| `node -e 1` in the guest | 154 ms |
| `armory-suite describe` | 44 ms |
| `gh --version` from the mounted closure | **736 ms per call** |
| Same, from a copy in guest tmpfs | **93 ms** (one-time copy 492 ms) |
| Preflight per spawned worker | 112 ms warm, 800 ms first |
| Teardown of a Crew | 55-120 ms, no residual process |

Without a suite, the VM boots lazily on the first tool call, so a launch pays only the
extension load and preflight (about +0.9 s). With the Armory proxy the VM boots at worker
start, because the proxy asks the guest to describe its tools.

## Space

| Item | Cost |
| --- | --- |
| Shared per Crew: comm + lifecycle servers | 55 + 84 MB |
| Per host worker: Pi + `worker.mjs` | about 260 + 52 MB |
| Per Gondolin worker: plus QEMU | +290 MB idle, up to 410-510 MB after use (1 GiB allotted, 2 vCPU) |
| Disk per worker | 2 MB worktree |
| Shared on disk | 316 MB guest images, 38 MB Armory closure |
| Guest `/tmp` | tmpfs, 484 MB of the guest's RAM |

A Gondolin + Armory worker is about 600-720 MB resident against about 310 MB on the host.

## Scale

Memory is the binding resource. On this 8 GiB machine about 7-10 Gondolin + Armory workers
fit, against 15-20 host workers. VM boots scale about linearly (about 0.5 s per VM
concurrently). Launch spawns workers one at a time, and each spawn runs a blocking
preflight (`qemu`, `qemu-img`, `nix --version`) in the lifecycle server. Disk and process
count are not a constraint.

## Assessment

**Efficient: yes.** No model cost, no extra turns, sub-second to two-second launch cost
per Crew, a 2 ms exec, and residue-free teardown. The one clear inefficiency is
large-binary exec through the VFS mount (736 ms against 93 ms).

**Scalable: bounded by RAM.** Each Gondolin worker costs about twice a host worker, and
VMs are held even by idle workers that wait for dispatch or prerequisites. That is a
tuning problem (guest memory, lazy boot), not a design flaw.

**Over-engineered: the code is not, the operational chain is.** The whole isolation layer
(Gondolin, Armory client, Nix, credentials) is 1,056 lines in 22 files, none over 160
lines, about 16% of the Crew extension. The weight is in the chain it depends on: Nix,
QEMU, Gondolin, a binary cache and a release catalog, to deliver a 37 MB closure. That is
justified by cross-OS delivery and immutability, and the simpler tarball path remains
documented as the next step if the chain's upkeep outweighs it.

**Brittle: two real weaknesses, both about failing open or silently.**

1. **A worker can lose its sandbox silently.** If the Gondolin extension fails to load
   (config drift, a missing dependency), Pi still starts, reports ready, and its
   built-in `read`/`grep`/`ls` act on the host. Seen live twice (the worker's tool list
   showed only built-ins, with no sandbox active). A `gondolin` worker must
   fail closed.
2. **Environment drift is invisible until runtime.** This session hit a validator that
   drifted from the policy it validates, a macOS-only descriptor error, a dependency
   missing from `node_modules`, and Nix's one-hour cached misses. Each was found by a
   live run, not by launch-time checks.

Positives: auto fallback to the host with a stated reason, a CI verify job that caught a
cache-key mismatch before any client did, and exactly-once, replay-safe dispatch paths.

## Recommendations, in order

1. **Fail closed.** Make a worker with a sandbox exit, and the launch fail fast, when its
   sandbox extension fails to load; do not let readiness depend only on the comm
   extension. Highest value, small change.
2. **Copy large closure binaries into guest tmpfs on first use** from the suite wrapper:
   736 ms to 93 ms per `gh` call.
3. **Do not boot the VM at worker start.** Embed tool descriptors in the release catalog so
   the proxy registers tools without the guest; idle workers then cost host-level memory
   until they run something.
4. **Right-size the guest.** The guest is allotted 1 GiB and used 290-510 MB; test 512 MB
   for tool-only workers.
5. **Run preflight once per Crew**, not per worker.
6. **Add a `doctor` check** that verifies dependencies, Nix, the cache and token at once,
   so drift is reported before a Crew launches.
