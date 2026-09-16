# Native Crew request-token baseline — 2026-09-16

## Run

- Run: `b9da343a-1e8c-4a59-9783-b4889b0fea8b`
- Task: two-specialist source/architecture review of the native-tool launch boundary; no repository edits.
- Configuration: unattended mode and `resultSummaryMaxBytes: null` (no result shaping).
- Durable record: [Discussion #441](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/441), closed with a final acceptance record.
- Telemetry: `.pi/fabric/crew-observability/b9da343a-1e8c-4a59-9783-b4889b0fea8b.jsonl` (intentionally untracked runtime evidence).

## Per-agent context ledger

| Agent                | Activity span | Static prompt (est.) | Tool schemas (est.) | `fabric_exec` call (est.) | `fabric_exec` result (est.) | Native call (est.) | Native result (est.) | Assistant text (est.) | Context before | Context after | Retained context Δ | Retention gap | Provider input | Provider reasoning |
| -------------------- | ------------: | -------------------: | ------------------: | ------------------------: | --------------------------: | -----------------: | -------------------: | --------------------: | -------------: | ------------: | -----------------: | ------------: | -------------: | -----------------: |
| `architect-tomashco` |      43.294 s |                3,155 |               1,098 |                       362 |                      12,650 |                650 |               12,998 |                   123 |          4,432 |        18,561 |            +14,129 |       -12,654 |         22,734 |                426 |
| `advisor-snowball`   |      58.444 s |                3,159 |                 922 |                       575 |                      12,811 |                727 |               15,667 |                   137 |          4,332 |        19,267 |            +14,935 |       -14,982 |         29,018 |                604 |
| `lead-old-major`     |     117.217 s |                3,561 |               2,005 |                       459 |                         247 |              1,246 |                3,091 |                    95 |          5,275 |        10,948 |             +5,673 |          +535 |         27,966 |                380 |

Columns marked “est.” use Pi's conservative model-facing transcript estimator: the serialized message text is divided by four and rounded up. They separately measure the expected context injection from the outer native-tool calls/results and outer `fabric_exec` code/results; no raw tool content is stored. Static prompt and schema estimates are diagnostics for the first activation and are intentionally excluded from Retained context Δ, because they already belong to Context before.

Context before/after/Δ are the `ctx.getContextUsage()` readings at the first and last responses. Provider input and reasoning are summed provider-reported usage values: input is repeated prompt processing across responses, not retained context; reasoning is generated-token usage, not a residual-context category.

Retention gap is `Retained context Δ − (executor call + executor result + native call + native result + assistant text)`. A negative gap means the estimated tool/message additions did not all appear in the final retained-context change. This can result from estimator error, lifecycle/context resets, compaction, provider serialization, or omitted/transformed result content. It must not be called “reasoning.”

## Outcome and caveat

The batch began at `10:54:37.621Z`; Discussion #441 closed at `10:56:27Z`. Both specialists posted findings, the Lead reviewed and accepted them, and specialist cleanup completed.

The Lead issued status asks before it observed the already-posted specialist findings. At `10:56:05Z`, an operator woke it once to refresh the canonical Discussion and finish closure. The table retains that recovery work. This is a baseline of the current implementation, including its completion-detection behavior.
