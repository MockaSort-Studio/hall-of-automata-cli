# Armory suite proposals

Status: proposals, nothing built. A suite is a set of typed tools over a native binary, run in the
worker's own VM ([armory-suite-inventory.md](armory-suite-inventory.md)). Adding one needs no new
mechanism: operation descriptors (name, description, schema, handler) plus a pinned binary,
published through the existing hall-armory pipeline.

## What a suite is for

A suite earns its place only if it does at least one of these better than `bash`:

1. **Opaque, compact calls.** The model sees a typed tool and a short result, not a shell session
   and a raw log. This is where the token saving is.
2. **Narrow grants.** A role can be given a tool without being given a shell. A reviewer cannot run
   `bash`, but it can run a linter, a format check or a CI-log reader.
3. **Scoped network and credentials**, enforced by Gondolin per suite.

Costs to weigh: every granted tool puts its schema in the model's context on every turn (about 130
tokens per tool, measured as 641 tokens for five), so tools stay coarse and roles are granted only
what they use; and each suite adds a build, a release and a fetch on first use.
A wrapper that merely mirrors `bash tool args` fails all three tests.

## Proposals

| # | Suite | Tools (coarse) | Why | Closure |
| --- | --- | --- | --- | --- |
| 1 | **CI run inspection**, added to `collaboration/pi-github-tools` | `github_workflow_runs_list`, `github_run_view` (job and step status), `github_run_failed_log` (failed steps, bounded tail) | The suite has `github_pull_request_checks` but nothing to see why a run failed. A raw run log can be tens of thousands of lines; a bounded failed-step tail is the compact-result case. Read-only, same `gh`, same token (needs `actions:read`). Reviewers get it without a shell. | none new |
| 2 | **`ci/workflow-lint`** (actionlint) | `workflow_lint` returning structured findings | A workflow can only be verified today by pushing and waiting minutes for CI. A local lint, with shellcheck's checks for `run:` scripts, catches syntax, expression and action-input mistakes first. Any repo with Actions can use it. No network, no credential. | about 5 MB, pinned static binary |
| 3 | **`dev/format`** (prettier) | `format_check`, `format_write` | `format:check` is a gate in this repo's `package.json`, and a sandboxed worker has no `node_modules` (hidden on purpose) so it cannot run it. Bundled into one runner with no network. | about 3 MB, bundled |
| 4 | **`dev/json`** (jq) | `json_query` | Weak case: the guest already has `node` and `python3`. Worth it only for roles with no shell. | about 1 MB |

| 5 | **`ci/workflow-run`** (`act` in host mode) | `workflow_run` (workflow, job, event) returning per-step status and a bounded failed-step tail; `workflow_list` | Runs the repo's real workflows before a push. Measured below. | about 19 MB, pinned static binary (over the 10 MB checklist limit; needs an explicit exception) |

Order: 1, then 2, then 5, then 3. Build 4 only when a bash-less role needs structured JSON.

## `act` inside the microVM: measured

An earlier version of this document rejected `act` as needing Docker. That was wrong: `act` has a
host mode (`-P ubuntu-latest=-self-hosted`) that runs steps directly on the machine it is on, and
here that machine is the worker's VM, which is already the isolation boundary. Containers inside it
would be redundant, and are not available anyway: the guest has no container runtime, no mounted
cgroups, and 86 MB of free disk.

Run on libkrun (M1) with the pinned `act` 0.2.89 linux/arm64 binary (19 MB):

| Run | Result |
| --- | --- |
| A three-step workflow (`run:` steps, `node`, `$GITHUB_WORKSPACE`) | Job succeeded |
| This repo's real `ci.yml`, job `validate`, on a copy of the repo | Job succeeded, 56 + 10 + 5 checks pass, 3.9 s |

Limits, so the tool is described honestly: the guest is Alpine/musl with Node 24, not an Ubuntu
runner, so steps that assume `apt` or glibc tools fail; Docker-based actions and `services:`
containers cannot run; third-party `uses:` actions need `github.com` in the suite's allowed hosts
and were not tested; there are no secrets, so steps that need them fail by design. It is a fast
pre-push check, not a replacement for CI.

## Deferred or rejected, with the trigger

| Candidate | Decision | Reason or trigger |
| --- | --- | --- |
| TypeScript (`tsc`) | Defer | This repo has no `tsconfig` and no type-check gate. Build when a repo adds one. |
| `rg` | Measure first | Pi's grep already runs through the VM filesystem. Count "command not found" bash turns in worker logs; build only if frequent. |
| Workflow dispatch (trigger a run) | Defer | A mutation. Build after 1 and 2 prove value, behind an explicit grant. |
| `git` in the guest | Reject | A worktree's `.git` points at a host path outside the mount; making it work breaks the isolation. Commits stay on the host. |
| Project dependencies (`npm install`, `node_modules`) | Reject | Project state, not a tool; the npm cache was rejected for Env on the same ground. |
| `shellcheck`, `yamllint` alone | Reject | actionlint covers workflow scripts and syntax; no other gate in CI. |
| Terraform | Defer | After the above, through the same contract. |

## Per-suite checklist

- A written trigger and a role that needs it.
- Closure of at most 10 MB, enforced by the existing CI size guard; pinned and hash-verified.
- Tools coarse; result size bounded.
- Network and credential scope in the manifest, empty by default.
- Guest compatibility test on Alpine with Node 24, as for the GitHub suite.
