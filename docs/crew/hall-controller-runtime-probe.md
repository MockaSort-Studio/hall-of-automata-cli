# Hall SDK worktree runtime

## Token ledger

| Case                          | System (est.) | Tool schemas (est.) | Tool calls (est.) | Tool results (est.) | Context after | Provider input/output | Wall time |
| ----------------------------- | ------------: | ------------------: | ----------------: | ------------------: | ------------: | --------------------: | --------: |
| Fabric                        |           763 |                 251 |                19 |                  65 |         1,037 |            2,837 / 96 |   9.827 s |
| SDK                           |           350 |                 151 |                73 |                  65 |         1,050 |           1,905 / 106 |   9.276 s |
| SDK native Discussion comment |           796 |                  86 |                26 |                  83 |           940 |              924 / 16 |   7.030 s |

Estimates are serialized model-facing content ÷ 4. Context after is Pi `getContextUsage().tokens` after settlement. SDK case: [Discussion #445](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/445).

SDK native Discussion comment: disposable Discussion #450; `github_discussion_comment` extension call; 1,702 ms tool duration; marker externally verified, then the Discussion and worktree were deleted.

## v0 design

```mermaid
flowchart TB
  Main[Main session]
  Lifecycle[Lifecycle runtime]
  A[SDK agent process + worktree]
  B[SDK agent process + worktree]
  Logs[Run logs]

  Main -->|spawn, monitor, delete| Lifecycle
  Lifecycle --> A
  Lifecycle --> B
  A --> Logs
  B --> Logs
```

- One agent = one fresh worktree + one standalone Pi SDK runner process.
- Each runner owns its own `AgentSession`, model context, selected extensions, and tools.
- Agents run in parallel.
- `bash` remains available as a fallback; supply role-relevant extensions first.
- Delete = stop runner process + remove worktree.

Not in v0: durability, recovery, communication, sandboxing.

## Observability

Write per-run and per-agent JSONL outside model context:

- run/agent start, end, exit, error, elapsed time;
- model and thinking level;
- provider input/output/reasoning/cache usage;
- context before/after;
- system prompt and tool-schema estimates;
- tool name, source (native/extension/custom), call/result estimates, duration, outcome.

No raw prompts or tool output by default.

## Plan

1. Build one SDK runner: fresh worktree, one bounded task, final status, JSONL telemetry.
2. Build Lifecycle spawn/list/delete around that runner.
3. Run two SDK agents in parallel; verify independent worktrees, logs, and deletion cleanup.
4. Add future concerns separately: durability, communication, sandboxing.
