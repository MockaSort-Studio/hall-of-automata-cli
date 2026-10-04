# Armory suite proposals and todo

Status: proposals, nothing built. A suite is a native binary run in the worker's own VM
([armory-suite-inventory.md](armory-suite-inventory.md)). Adding one needs no new mechanism for
typed tools: operation descriptors (name, description, schema, handler) plus a pinned binary,
released through the existing hall-armory pipeline.

## Two ways to expose a binary

| Exposure | The model sees | Cost per turn | Good for |
| --- | --- | --- | --- |
| **Typed tool** | a named operation, a schema, a compact result | its schema, about 130 tokens (641 measured for five), mostly cache reads | noisy or large output; roles with no shell; credential or network scope |
| **Binary on `PATH`** | nothing new; used through `bash` | none | small, model-filtered output (`jq`, `yq`) in roles that already have `bash` |

A typed tool that only forwards arguments to a binary adds its schema cost and gains nothing when
the role already has `bash`. It pays off when at least one of these holds:

1. **The raw output is large or noisy** and the tool returns a bounded summary. Only what a tool
   returns enters the model's context; `bash` passes everything through (up to Pi's own cap of 50 KB
   per call). Keep the full log in a workspace file so a failure can be read on demand.
2. **The role has no `bash`.** Grants are the only way to allow `act` and nothing else, or a linter
   without a shell. A reviewer is such a role.
3. **Scoped network or credentials**, which Gondolin enforces per suite.

## Measured

| Binary | Raw output through `bash` | Compact typed result |
| --- | --- | --- |
| `act`, this repo's `ci.yml` `validate` job | 10,939 chars, 173 lines, about 2,700 tokens, 48% of it repeated git warnings | step status lines, about 100 tokens |
| `prettier --check` on this repo | 3,231 chars for 57 failing files, about 800 tokens | a count and the first few paths |
| `jq`, `yq` | whatever filter the model writes; small | no gain |

So `act` and CI logs are clear typed-tool cases, `prettier` is borderline, and `jq`/`yq` are not.

## `act` inside the microVM

`act` has a host mode (`-P ubuntu-latest=-self-hosted`) that runs steps directly on the machine it is
on; here that is the worker's VM, which is already the isolation boundary. Containers inside it are
neither needed nor possible: the guest has no container runtime, no mounted cgroups and 86 MB free.
On libkrun with `act` 0.2.89 (19 MB static, linux/arm64): a three-step workflow succeeded, and this
repo's real `ci.yml` job `validate` passed in 3.9 s (56 + 10 + 5 checks).

Limits: the guest is Alpine with **musl and no glibc** (no `ld-linux`, no `libc.so.6`, no `gcompat`),
and steps run on Node 24, so a downloaded glibc binary (a toolchain from `setup-*`, a manylinux wheel)
will not run; Docker-based actions and `services:` containers cannot run; third-party `uses:` actions
need `github.com` allowed and were not tested; there are no secrets. A fast pre-push check, not a
replacement for CI.

## Todo, in order

- [ ] **S1. CI run inspection** (typed; extends `collaboration/pi-github-tools`). Tools
  `github_workflow_runs_list`, `github_run_view` (job and step status), `github_run_failed_log`
  (failed steps, bounded tail). The suite has `github_pull_request_checks` but nothing to see why a
  run failed; raw run logs run to tens of thousands of lines. Read-only, same `gh` and token (needs
  `actions:read`). No new closure.
- [ ] **S2. `ci/workflow-lint`** (typed; actionlint, about 5 MB). `workflow_lint` returns structured
  findings, with shellcheck's checks for `run:` scripts. A workflow is otherwise verified by pushing
  and waiting minutes. No network, no credential.
- [ ] **S3. `ci/workflow-run`** (typed; `act`, about 19 MB, needs an exception to the 10 MB limit).
  `workflow_run` (workflow, job, event) returns per-step status and a bounded failed-step tail, and
  writes the full log to a workspace file; it drops the repeated git warnings. `workflow_list`.
- [ ] **S4. `dev/format`** (prettier, about 3 MB, bundled). First decide what `format:check` is for:
  it fails on 57 files today and CI does not run it. Either run `prettier --write` once and enforce
  it, or drop the gate. Build only after that; expose on `PATH`, with a typed `format_check` only
  for roles without `bash`.
- [ ] **S5. `dev/yaml`** (`yq`, about 5 MB). `PATH` only. Trigger: a role must edit workflow or
  config YAML structurally; the guest has no YAML parser in `node` or `python3`.
- [ ] **S6. `dev/json`** (`jq`, about 1 MB). `PATH` only. Trigger: a role needs structured JSON and
  cannot use `node` or `python3`. Weak: both are in the guest.
- [ ] **S7. `PATH` exposure in the suite manifest** (`binaries`), validated by the client and put
  on the guest `PATH` for `bash`. Needed only when S4 to S6 are built; typed-only suites (S1 to S3)
  do not need it.

## Deferred or rejected, with the trigger

| Candidate | Decision | Reason or trigger |
| --- | --- | --- |
| TypeScript (`tsc`) | Defer | No `tsconfig` and no type-check gate here. Build when a repo adds one. |
| `rg` | Measure first | Pi's grep already runs through the VM filesystem. Count "command not found" bash turns in worker logs. |
| Workflow dispatch | Defer | A mutation. After S1 to S3 prove value, behind an explicit grant. |
| `git` in the guest | Reject | A worktree's `.git` points at a host path outside the mount; making it work breaks the isolation. |
| Project dependencies (`npm install`) | Reject | Project state, not a tool; the npm cache was rejected for Env on the same ground. |
| `shellcheck`, `yamllint` alone | Reject | actionlint covers workflow scripts and syntax. |
| Terraform | Defer | After the above, through the same contract. |

## Per-suite checklist

- A written trigger and a role that needs it.
- Closure of at most 10 MB unless justified, enforced by the existing CI size guard; pinned and
  hash-verified.
- Typed tools coarse, with bounded results and the full log kept in a file.
- Network and credential scope in the manifest, empty by default.
- Guest compatibility test on Alpine with Node 24 (musl), as for the GitHub suite.
