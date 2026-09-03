import { strict as assert } from "node:assert";
import { test } from "node:test";
import { minimalCrewResult, minimizeCrewContext } from "../../.pi/extensions/crew/lib/context.mjs";

test("Crew result projection removes Fabric transport markup and details", () => {
  const message = {
    role: "custom",
    customType: "pi-fabric-agent-message",
    content: "<fabric-agent-message>verbose transport</fabric-agent-message>",
    details: { data: {
      kind: "crew_result", runId: "12345678-abcd", outcome: "PASS",
      summary: "Verified the bounded acceptance criteria.",
      finalCommentUrl: "https://example.test/final",
    } },
  };
  const [projected] = minimizeCrewContext([message]);
  assert.equal(projected.details, undefined);
  assert.equal(projected.content, "[Crew result 12345678] PASS. Verified the bounded acceptance criteria. Record: https://example.test/final");
  assert.ok(!projected.content.includes("fabric-agent-message"));
});

test("Crew result projection is bounded and leaves unrelated messages unchanged", () => {
  const ordinary = { role: "user", content: "keep me" };
  assert.equal(minimizeCrewContext([ordinary])[0], ordinary);
  assert.ok(minimalCrewResult({ runId: "run", outcome: "PASS", summary: "x".repeat(1000) }).length < 400);
  assert.equal(minimalCrewResult({ runId: "run-1234", outcome: "PASS", summary: "PASS: verified" }), "[Crew result run-1234] PASS. verified");
});
