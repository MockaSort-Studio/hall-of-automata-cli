# KR 7.4 Context Growth Analysis

Run: `82b94656-da13-4f64-b862-086ecaaae64f`

## Finding

The 203,339-token aggregate context increase was primarily caused by unbounded tool-result
payloads being retained in warm actor history. Fabric then carried that history across every
turn and durable activation without a configured context ceiling or a compaction event.

## Evidence

| Actor | First | Last | Growth | Responses | Jumps ≥3k | Tokens in those jumps | Share |
|---|---:|---:|---:|---:|---:|---:|---:|
| Lead | 6,741 | 84,529 | 77,788 | 31 | 8 | 57,632 | 74.1% |
| Developer | 4,702 | 81,181 | 76,479 | 20 | 6 | 62,295 | 81.5% |
| Advisor | 4,897 | 53,969 | 49,072 | 16 | 5 | 42,544 | 86.7% |
| **Aggregate** | **16,340** | **219,679** | **203,339** | **67** | **19** | **162,471** | **79.9%** |

The worst consecutive jumps were:

- Lead: +13,873, +9,353, and +8,029 tokens.
- Developer: +15,990 and +16,557 tokens in consecutive responses, followed by +9,059
  and +9,988.
- Advisor: +15,869, +10,051, and +8,948 tokens.

Those shapes are consistent with large `fabric_exec` results entering the next provider
prompt, especially batched reads. Normal assistant responses do not explain 16k-token jumps.
Only 31,138 output tokens were generated across the whole run; repeated large evidence
payloads and instructions dominate the retained context.

## Contributing causes

### 1. No bound on outer tool results

Pi bounds an individual file read, but one `fabric_exec` call can aggregate several reads and
return them together. The Crew discipline says nothing measurable about maximum returned
bytes. UI collapse is not context compaction: collapsed rich results still belong to session
history unless the model-facing result is summarized.

### 2. No proactive context policy

The launch config contains no `maxTokens`, budget, or compaction policy. The Crew extension
never calls `agents.compact`, and KR 7.4 emitted no `pi.session_compact` lifecycle event.
Native Pi compaction therefore had no reason to trigger before actors reached 54k–85k tokens.

Fabric's existing `maxTokens` guard is a cumulative-use termination budget, not a warm-context
high-water compactor. Reusing it would kill useful actors rather than control retained history.

### 3. Oversized and stale constructor prompts

The exact Lead instruction was 15,661 characters across 269 lines. Current minimal assembled
prompts are 6,454 characters for the developer and 8,069 for the advisor before a real task is
added. The Lead inherits obsolete Claude-era routing instructions about `.hall/agents.json`,
labels, and dispatch files that do not belong in a Pi Crew run.

The base contract is also fetched live during assembly, so prompt size and content can drift
between runs without a code revision.

### 4. Excess turn churn

The Crew made 67 provider responses in roughly ten minutes; the Lead alone made 31. Small
poll/status turns did not cause the largest jumps, but they retained additional prose and
reprocessed the full warm context. The 2,742,272 cache-read tokens measure repeated prompt
processing, not 2.7M tokens of unique context.

### 5. Missing post-run attribution

Actor removal deleted detailed actor-local traces. Retained telemetry preserves per-response
usage but not the exact tool name and model-facing result size responsible for each jump.
This analysis can prove concentration and policy absence, but cannot honestly name every
large read after the fact. That observability loss is itself a defect.

## Ruled out

- **Durable resume duplication:** developer and advisor resumed with only +799 and +614
  tokens respectively; history was continued, not copied into itself.
- **Crew messages:** Discussion and mesh messages were short and too few to explain the
  concentrated 9k–16k jumps.
- **Cache reads as unique growth:** cache-read totals are repeated processing of retained
  context, not additional context appended each turn.
