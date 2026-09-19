import { strict as assert } from "node:assert";
import test from "node:test";
import { boundedText, mapWorkerEvent } from "../../.pi/extensions/runtime/lib/worker-events.mjs";

test("mapWorkerEvent produces a content-free tool_end record with a size, not the payload", () => {
  const entry = mapWorkerEvent({
    type: "tool_execution_end",
    toolCallId: "call_1",
    toolName: "bash",
    isError: false,
    result: { content: [{ type: "text", text: "x".repeat(500) }] },
  });
  assert.equal(entry.type, "tool_end");
  assert.equal(entry.error, false);
  assert.ok(entry.resultBytes > 500);
  assert.equal(JSON.stringify(entry).includes("x".repeat(500)), false);
});

test("mapWorkerEvent records content-free turn size and tool-call counts", () => {
  const bigText = "y".repeat(20_000);
  const entry = mapWorkerEvent({
    type: "turn_end",
    message: {
      usage: { input: 10, output: 20 },
      content: [
        { type: "text", text: bigText },
        { type: "toolCall", id: "call_1", toolName: "bash" },
      ],
    },
  });
  assert.equal(entry.type, "turn");
  assert.deepEqual(entry.usage, { input: 10, output: 20 });
  assert.equal(entry.outputChars, 20_000);
  assert.equal(entry.toolCalls, 1);
  assert.equal(Object.hasOwn(entry, "output"), false);
});

test("mapWorkerEvent surfaces compaction lifecycle events", () => {
  assert.deepEqual(mapWorkerEvent({ type: "compaction_start", reason: "threshold" }), {
    type: "compaction_start",
    reason: "threshold",
  });
  assert.deepEqual(mapWorkerEvent({ type: "compaction_end", reason: "threshold" }), {
    type: "compaction_end",
    reason: "threshold",
  });
});

test("mapWorkerEvent bounds extension errors and skips unrelated event types", () => {
  const entry = mapWorkerEvent({ type: "extension_error", error: "z".repeat(10_000) });
  assert.equal(entry.type, "agent_error");
  assert.ok(entry.message.length < 10_000);
  assert.equal(mapWorkerEvent({ type: "queue_update" }), null);
});

test("boundedText passes short text through unchanged and truncates long text", () => {
  assert.equal(boundedText("short", 100), "short");
  assert.match(boundedText("a".repeat(200), 100), /truncated/);
});
