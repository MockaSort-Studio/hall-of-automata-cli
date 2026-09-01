# KR 7.4 Phase 3 parity gate

**Verdict: BLOCKED — parity was not established.**

A faithful dual-target run is impossible with the existing Saga 3 Hall Wits harness. Its target interface can launch only the Claude plugin; selecting the `dev` revision still exercises the unchanged Claude-plugin surfaces rather than the Pi/Fabric Crew implementation. The release gate remains closed.

- Issue: [#359](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/359)
- Canonical Crew record: [Discussion #396](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/396)
- Run: `82b94656-da13-4f64-b862-086ecaaae64f`

## Provenance

| Item | Recorded revision |
|---|---|
| Claude-plugin baseline | `master` at `16f10a90152673126722fd5a6b75b1de30188292` |
| Pi Crew target | `dev` at `78f9f46728283021787dfa22052057353ede83e2` |
| Eval workflow | `.github/workflows/hall-wits-eval-core.yml`, SHA-256 `02cf3d54efb4d9927dbd9c080f2a39df4555e3099f988bd3e6f1da820b610294` at both revisions |
| Claude runner | `tests/hall-wits/runner.py`, SHA-256 `003f4cf523b652511eaf9ed9bdc5452d10ee18d950c5b27dae24a81b3339b161` at both revisions |
| Golden task | `golden-path-01` task blob `70caf3c3e7b60b43a70a0549b064571b99fcee6c` |
| Turn 1 | blob `1781020d98c9e95748d75737fa4e4af6f8c12440`: add `/hall:archive` |
| Turn 2 | blob `3ec289dbff84d9bbad09278b7f9d9ed2df723723`: repair duplicate `hall-status` grouping |
| Calibration | blob `7759241e8444395ae33fbb53e99627e3c2eef6b0` |
| Popotron persona | blob `54c557c0c7ef9214a008c1f26567e2b95fe189ac` |
| Runtime observed | Claude Code `2.1.206`; Pi `0.84.3` |

The executor refreshed refs with `git fetch --prune origin` and `git ls-remote`. Lead verification independently reproduced both branch SHAs and both file hashes. `commands/`, `skills/`, and `hooks/` have no content diff between the two revisions.

These are **recorded snapshots, not pins enforced by the workflow**. The workflow checks out the harness from symbolic `master`, fetches arena fixture/calibration/persona paths without `ref`, installs unversioned Claude Code, and uses moving model aliases including `claude-sonnet-5`.

## Existing harness contract

The workflow accepts a `plugin-sha`, checks that revision out as `pr-plugin`, and invokes:

```text
runner.py ... --plugin-dir <pr-plugin> --cc-bin claude
```

The runner bootstraps `/hall-of-automata-cli:hall-open` and passes Claude-only options including `--output-format stream-json`, `--dangerously-skip-permissions`, and `--plugin-dir`.

The Crew target is registered under `.pi/extensions/crew/` through `start_crew` / `crew-start` and Fabric actors. The existing runner has no Pi/Fabric target selector. Consequently:

- baseline SHA through the harness → Claude-plugin implementation;
- Crew SHA through the harness → the same Claude-plugin implementation;
- no unchanged-harness path → Pi Crew implementation.

Treating the second case as a Crew run would compare the Claude plugin to itself.

## Commands and observed outputs

### Direct interface probe

```bash
/opt/homebrew/bin/pi --print '/hall-of-automata-cli:hall-open' \
  --output-format stream-json --verbose \
  --dangerously-skip-permissions \
  --plugin-dir /tmp/kr74-82b94656/crew
```

Exit: `1`

```text
Error: Unknown options: --output-format, --dangerously-skip-permissions, --plugin-dir
```

This proves that Claude CLI arguments are not a Pi adapter. It does not prove that no adapter can be built; adding one would change the existing harness contract and requires a separately approved parity design.

### Identical local runner probes

Both relevant credentials were explicitly unset. Detached worktrees were used at the two immutable revisions.

Baseline:

```bash
env -u HALL_WITS_ARENA_TOKEN -u CLAUDE_CODE_OAUTH_TOKEN \
  python3 /tmp/kr74-82b94656/baseline/tests/hall-wits/runner.py \
  fixtures/golden-path-01 /tmp/kr74-82b94656/run-baseline \
  --plugin-dir /tmp/kr74-82b94656/baseline \
  --cc-bin /opt/homebrew/bin/claude
```

Crew revision:

```bash
env -u HALL_WITS_ARENA_TOKEN -u CLAUDE_CODE_OAUTH_TOKEN \
  python3 /tmp/kr74-82b94656/crew/tests/hall-wits/runner.py \
  fixtures/golden-path-01 /tmp/kr74-82b94656/run-crew \
  --plugin-dir /tmp/kr74-82b94656/crew \
  --cc-bin /opt/homebrew/bin/claude
```

Both exited `1` with exactly:

```text
error: HALL_WITS_ARENA_TOKEN not set
```

Each run directory contained only its seeded `manifest.json`. Neither execution reached the task, structural checker, or judge. Missing local secrets are secondary and remediable; the enduring blocker is the harness’s inability to select the Crew target even where CI credentials exist.

## Results and comparison

| Evidence | Baseline | Crew target | Comparison |
|---|---|---|---|
| Target reached | No | No | No dual-target execution |
| Transcript | None | None | Not comparable |
| Structural checker | Not run | Not run | Not comparable |
| Raw judge output | None | None | Not comparable |
| Eight judge dimensions | None | None | Not comparable |
| Aggregate judge result | None | None | Not comparable |
| Cleanup result | No live fixture provisioned | No live fixture provisioned | No state comparison |

There are zero criterion-level judged outcomes. Neither equivalence nor non-equivalence can be inferred.

## Contract-scope limitation

The located `golden-path-01` task/checker verifies the general four-stage Hall pipeline and Claude eval-dispatch behavior: OKR gates, issue relationships, board fields, wiki tags, run-tag hygiene, and an eval-dispatch plan. It does not specify hall-saga Phase 3 research/fact-checking, Crew exchanges, or the KR 7.3 lead responsibilities. It is therefore not established as a Phase 3 Crew parity contract.

A valid future parity run must first identify or approve a golden contract that addresses both implementations, then pin the harness, fixtures, runtime, models, prompts, permissions, and clean-state semantics. It must preserve per-target commands, resolved versions, stdout/stderr, exits, transcripts, checker output, raw judge response, all dimension scores, and cleanup outcomes.

## Release-gate disposition

1. Do not merge the Crew implementation to `master` on this evidence.
2. Do not claim parity.
3. Approve a dual-target adapter/contract before rerunning.
4. Supply isolated arena credentials and immutable runtime/model/fixture pins.
5. Compare judge dimensions and derivations, not merely one stochastic aggregate score.

No branch was merged, no implementation file was edited, no live Claude-plugin surface was altered, and no live arena fixture was provisioned during this verification.

## Durable evidence

- [Executor command-level finding](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/396#discussioncomment-18232720)
- [Independent gate audit](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/396#discussioncomment-18232699)
- [Threaded criterion-by-criterion cross-review](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/396#discussioncomment-18232727)
- [Lead acceptance of executor evidence](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/396#discussioncomment-18232734)
