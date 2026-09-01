import { strict as assert } from "node:assert";
import { test } from "node:test";
import { crewPaths, launchCode, parseRepository, queuedMessage } from "../../.pi/extensions/crew/lib/startup.mjs";

test("crew paths are relative to the install config directory", () => {
  assert.deepEqual(crewPaths(".pi", "run-1"), {
    roster: ".pi/fabric/crew-launch/run-1-roster.json",
    config: ".pi/fabric/crew-launch/run-1.json",
  });
  assert.deepEqual(crewPaths(".custom", "run-1"), {
    roster: ".custom/fabric/crew-launch/run-1-roster.json",
    config: ".custom/fabric/crew-launch/run-1.json",
  });
});

test("repository coordinates are discovered rather than host-coded", () => {
  assert.deepEqual(parseRepository("owner/repository\n"), {
    owner: "owner",
    repo: "repository",
  });
  assert.throws(() => parseRepository("repository"), /Unable to resolve/);
});

test("queued acknowledgment is user-facing and promises terminal return", () => {
  const message = queuedMessage({ runId: "run-1" });
  assert.equal(message, "Crew run-1 is queued. Its terminal result or launch failure will be returned to this Pi session automatically.");
  assert.ok(!message.includes("roster"));
  assert.ok(!message.includes("config"));
});

test("replayed launch returns existing terminal state without creating an actor", async () => {
  const code = launchCode("config.json");
  const files = new Map([
    ["config.json", JSON.stringify({ runId: "run-1", topic: "crew.run-1", rosterFile: "roster.json", lead: {} })],
    ["roster.json", JSON.stringify({ status: "closed", lead: { actorId: "lead-1" } })],
  ]);
  let creates = 0;
  const fakePi = { read: async path => files.get(path) };
  const fakeAgents = { create: async () => { creates += 1; } };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const result = await new AsyncFunction("pi", "agents", code)(fakePi, fakeAgents);
  assert.deepEqual(result, {
    runId: "run-1", topic: "crew.run-1", leadId: "lead-1",
    status: "closed", alreadyLaunched: true,
  });
  assert.equal(creates, 0);
});

test("launch code uses Fabric APIs and relative config paths", () => {
  const code = launchCode(".custom/fabric/crew-launch/run-1.json");
  assert.match(code, /roster\.status !== 'queued'/);
  assert.match(code, /alreadyLaunched: true/);
  assert.match(code, /newText: '"status": "launching"'/);
  assert.match(code, /agents\.create\(cfg\.lead\)/);
  assert.match(code, /agents\.followUp/);
  assert.ok(!code.includes("agents.tell"));
  assert.match(code, /status: 'started'/);
  assert.match(code, /roster\.status = 'failed'/);
  assert.match(code, /agents\.remove/);
  assert.ok(!code.includes("/Users/"));
  assert.ok(!code.includes("Workspace/"));
});
