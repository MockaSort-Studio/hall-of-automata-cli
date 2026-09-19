import { strict as assert } from "node:assert";
import test from "node:test";
import { summarizeWorkerEvents } from "../../.pi/extensions/runtime/lib/worker-metrics.mjs";

test("separates provider traffic from unique-token claims", () => {
  const metrics = summarizeWorkerEvents([
    { type: "turn", usage: { input: 10, output: 20, cacheRead: 100, cacheWrite: 30, totalTokens: 160 } },
    { type: "turn", usage: { input: 11, output: 21, cacheRead: 200, cacheWrite: 31, totalTokens: 263 } },
    { type: "tool_start" },
    { type: "tool_end", error: true },
    { type: "compaction_end" },
  ]);
  assert.deepEqual(metrics, {
    turns: 2,
    toolCalls: 1,
    toolErrors: 1,
    compactions: 1,
    providerTraffic: {
      uncachedInput: 21,
      generatedOutput: 41,
      cacheRead: 300,
      cacheWrite: 61,
      total: 423,
      maxCacheReadPerTurn: 200,
    },
  });
});
