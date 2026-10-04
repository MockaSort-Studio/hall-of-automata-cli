# Gondolin benchmark, assessment and optimization

Measured 2026-10-04 on one machine: Apple M1, 8 GiB RAM (about 2 GiB free), 8 cores,
QEMU with Hypervisor.framework acceleration, `@earendil-works/gondolin` 0.12.0. Single
runs or small samples; treat differences under about 20% as noise. Summed RSS
double-counts shared pages, so memory is an upper bound.

Reproduce: `node scripts/bench/crew-scale.mjs <none|gondolin|armory> <N>` (launch cost,
no model calls) and `node scripts/bench/gondolin-vm.mjs` (VM and Armory path costs).

## Model usage

Same trivial task on one worker, host versus Gondolin with the Armory GitHub suite:
14,497 versus 14,744 tokens (+1.7%), $0.0160 versus $0.0164, identical turns and tool
calls; the granted tool schema is about 40 tokens. **Model cost is not a factor.**

## What the first measurement found, and what was done

| Finding | Action | Result |
| --- | --- | --- |
| A worker's Pi auto-discovered the worktree's `.pi` and loaded the whole Crew extension, which no worker uses | `--no-approve` (ignores project-local files; user-level provider extensions and explicit `--extension` still load) | Pi 251 to about 160 MB (-35%), ready 0.95 to 0.61 s |
| `--no-extensions` looked better still (121 MB) | **Rejected**: it also drops the user's provider-auth extension, so every model call failed (`out of extra usage`) | kept `--no-approve` |
| `gh` ran from the mounted closure: 736 ms per call | Suite wrapper copies it to guest tmpfs on first use (hall-armory PR #6) | 93 ms per call; a GitHub call now matches the host's own `gh` (median 863 ms vs 910 ms, network-bound) |
| A VM was held for the worker's whole life, even while idle or waiting for dispatch | Release after 20 s idle (never mid-run or mid-tool), boot again on the next call, warm it when a run starts | Held Armory workers: 3 workers 1,874 MB to 716 MB total; the VM is back in about 0.8 s |
| Armory proxy imported the Gondolin extension through a native `import()` | Merged into the Gondolin extension; one fewer extension file and worker argument | removed the local `pi-coding-agent` from production dependencies (now dev-only); two classes of failure gone |
| A `session_start` error was logged and swallowed, leaving a worker "ready" without its tools | The extension ends the worker (exit 70); a launch now also fails as soon as any worker exits before ready | launch failure in under 1 s instead of a 30 s timeout |
| Sandbox preflight re-ran its checks for every worker | Reuse a success for 30 s | about 110 ms saved per extra worker |
| Dead code from earlier approaches | Removed the live-catalog resolvers (a second, `main`-branch entrypoint), `sandbox-extension-paths`, `issueCredentialLease`, two exports | -1 module, -3 functions |

## Before and after

| | Before | After |
| --- | --- | --- |
| Host worker ready, 1 / 4 workers | 0.95 / 1.6 s | 0.61 / 1.2 s |
| Gondolin worker ready, 1 / 4 | 1.9 / 3.0 s | 1.15 / 2.0 s |
| Gondolin + Armory ready, 1 / 2 / 3 | 2.1 / 3.3 s / - | 2.3 / 2.8 / 3.4 s |
| Armory worker, VM up, resident | about 600-720 MB | about 580-880 MB (noisy; not better: the `gh` copy adds about 90 MB at launch) |
| Armory worker, idle (VM released) | about 600-720 MB | about 190-300 MB |
| `gh` call overhead inside the guest | +736 ms | about 0 (network-bound) |
| Failed launch noticed | 30 s timeout | under 1 s |

Armory workers at launch hold the VM for the startup `describe`, and the wrapper's `gh`
copy adds about 90 MB of guest page cache and tmpfs there. That is the price of the
faster calls, and it is returned when the VM is released.

## Where the memory is now

Per active Gondolin worker: Pi about 160-230 MB, `worker.mjs` 52 MB, QEMU 290 MB idle and
450-510 MB after real work (a floor set by QEMU's own overhead and the guest's page
cache, not by the allotted RAM). Shared per Crew: comm and lifecycle servers 139 MB.

Tried and rejected, with measurements:
- **Smaller guest RAM** (1 GiB to 256 MiB): resident only 291 to 252 MB idle and 525 to 455 MB
  after use, and tool workloads may need the memory.
- **libkrun** (`vmm: krun`): 25% lighter idle (213 vs 285 MB) but only 6% after use
  (440 vs 470 MB); not worth leaving the default backend.
- **A second VM per worker** (suspected from a duplicated module): refuted, one VM.

The remaining lever is policy, not tuning: one VM per active worker is the isolation
decision. Cutting active memory further means sharing a VM across workers or running
read-only roles without one; both weaken isolation and are for a human to decide.

## Assessment

**Efficient: yes.** No model cost, sandbox overhead on a GitHub call is nil, launch costs
about 0.5-1.5 s over the host, a booted VM executes in 2 ms, teardown takes 45-80 ms with
no residue.

**Scalable: RAM-bound, now only for active workers.** About 7-10 active Gondolin workers
fit on this 8 GiB machine; idle or waiting ones cost host-level memory.

**Over-engineered: the code no, the chain yes.** The isolation layer is about 1,000 lines
in 22 files, none over 160 lines, after removing dead code. The weight is the dependency
chain (Nix, QEMU, Gondolin, a binary cache, a release catalog) delivering a 37 MB closure;
the simpler tarball path stays documented as the next step.

**Brittle: lower, and the original claim was overstated.** An earlier version of this
document said a failed sandbox extension left the worker running on the host. That was
wrong: Pi exits when an explicitly requested extension fails to load, and the two live
failures were handler errors that left a worker without its tools while its built-in tools
stayed routed to the VM (fail-closed at use, silent at launch). Both are now fatal at
launch. What remains brittle is environment drift (dependencies, Nix, the cache, the
token), which launch-time checks report and fall back from, and the per-user Pi setup that
workers inherit (provider auth).
