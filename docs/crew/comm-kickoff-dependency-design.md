# Comm-native kickoff and dependency design

## Implemented flow

The Lead sends one `comm_kickoff` broadcast to Crew actors only. It contains a shared `goal`, relevant `context`, and one assignment per local member handle:

```text
to, task, done, dependsOn[]
```

Workers retain the plan, execute immediately when `dependsOn` is empty, and otherwise wait for directed `complete` messages from every named prerequisite. The Runtime owns run-namespaced transport IDs; model-facing handles remain local and ordinal-suffixed.

On completion, a worker uses `comm_notify_many` to send evidence to the configured Lead and only direct dependents. Kickoff does not reach Main; terminal `comm_notify_all` does.

## Why this shape

It keeps Comm as delivery only, preserves parallel independent work, avoids needless completion broadcasts, and does not couple base Crew to GitHub Discussions or Fabric.

## Remaining design work

- Make dependency waiting and release a worker-side deterministic state machine rather than prompt discipline alone.
- Validate dependency handles, reject cycles, and report unsatisfied dependencies in `comm_kickoff`.
- Derive direct dependents from the kickoff plan for a safe completion-recipient helper.
- Add an end-to-end test: parallel roots, chained dependency, exact directed recipients, Lead final report.
- Define timeout/retry/release semantics for a failed dependency and ensure Lead receives blocked status.
