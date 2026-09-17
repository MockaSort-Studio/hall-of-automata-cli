import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  assistantTextTokens,
  staticContextTokens,
  toolCallTokens,
  toolKind,
  toolResultTokens,
  toolWindowTotals,
} from "../../.pi/extensions/crew/lib/observability-ledger.mjs";

test("ledger distinguishes native and Fabric calls with model-facing token estimates", () => {
  assert.equal(toolKind("fabric_exec"), "fabric_exec");
  assert.equal(toolKind("crew_post"), "native");
  assert.ok(toolCallTokens("crew_post", { message: "evidence" }) > 0);
  assert.equal(toolResultTokens({ content: [{ type: "text", text: "abc" }] }), 1);
  assert.equal(assistantTextTokens({ content: [{ type: "text", text: "abcd" }] }), 1);
});

test("ledger keeps static and window totals separate", () => {
  assert.deepEqual(staticContextTokens("abcd", [{ name: "crew_post", parameters: {} }]).systemPrompt, 1);
  assert.deepEqual(
    toolWindowTotals([
      { kind: "native", callTokens: 2, resultTokens: 3 },
      { kind: "fabric_exec", callTokens: 5, resultTokens: 7 },
    ]),
    {
      fabric_exec: { calls: 5, results: 7, count: 1 },
      native: { calls: 2, results: 3, count: 1 },
    },
  );
});
