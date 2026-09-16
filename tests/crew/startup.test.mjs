import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crewPaths, launchCode, parseRepository, queuedMessage } from "../../.pi/extensions/crew/lib/startup.mjs";

const source = readFileSync(new URL("../../.pi/extensions/crew/lib/startup.mjs", import.meta.url), "utf8");

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
  assert.match(message, /Crew run-1/);
  assert.match(message, /terminal result or launch failure/);
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
  const fakePi = { read: async (path) => files.get(path) };
  const fakeAgents = {
    create: async () => {
      creates += 1;
    },
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const result = await new AsyncFunction("pi", "agents", code)(fakePi, fakeAgents);
  assert.deepEqual(result, {
    runId: "run-1",
    topic: "crew.run-1",
    leadId: "lead-1",
    status: "closed",
    alreadyLaunched: true,
  });
  assert.equal(creates, 0);
});

test("Main preassembles and registers specialists before waking the Lead", async () => {
  const files = new Map([
    [
      "config.json",
      JSON.stringify({
        runId: "run-1",
        topic: "crew.run-1",
        rosterFile: "roster.json",
        members: [{ name: "architect-tomashco", role: "architect" }],
        lead: { name: "lead-old-major" },
        assignment: "work",
      }),
    ],
    ["roster.json", JSON.stringify({ runId: "run-1", status: "queued", members: [] })],
  ]);
  const writes = [];
  const created = [];
  const fakePi = {
    read: async (path) => files.get(path),
    edit: async ({ path, oldText, newText }) => files.set(path, files.get(path).replace(oldText, newText)),
    write: async ({ path, text }) => {
      writes.push(JSON.parse(text));
      files.set(path, text);
    },
  };
  const fakeAgents = {
    createMany: async ({ actors }) => {
      created.push(...actors.map((actor) => actor.name));
      return actors.map((actor) => ({ id: `${actor.name}-id`, name: actor.name }));
    },
    create: async (definition) => {
      created.push(definition.name);
      return { id: `${definition.name}-id`, name: definition.name };
    },
    tell: async ({ id, message }) => {
      assert.equal(id, "lead-old-major-id");
      assert.equal(message, "work");
    },
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const result = await new AsyncFunction("pi", "agents", launchCode("config.json"))(fakePi, fakeAgents);
  assert.deepEqual(created, ["architect-tomashco", "lead-old-major"]);
  assert.deepEqual(result, {
    runId: "run-1",
    topic: "crew.run-1",
    leadId: "lead-old-major-id",
    status: "started",
    memberIds: ["architect-tomashco-id"],
  });
  assert.deepEqual(writes.at(-1).members, [
    { name: "architect-tomashco", actorId: "architect-tomashco-id", role: "architect" },
  ]);
  for (const field of ["batchStartedAt", "batchCreatedAt", "leadWokenAt"])
    assert.match(writes.at(-1)[field], /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(writes.at(-1).supervisor, undefined);
});

test("launch failure disbands rostered and late topic actors", async () => {
  const files = new Map([
    [
      "config.json",
      JSON.stringify({
        runId: "run-1",
        topic: "crew.run-1",
        rosterFile: "roster.json",
        members: [],
        lead: { name: "lead-old-major" },
        assignment: "work",
      }),
    ],
    ["roster.json", JSON.stringify({ runId: "run-1", status: "queued", members: [] })],
  ]);
  const fakePi = {
    read: async (path) => files.get(path),
    edit: async ({ path, oldText, newText }) => files.set(path, files.get(path).replace(oldText, newText)),
    write: async ({ path, text }) => files.set(path, text),
  };
  const removed = [];
  const fakeAgents = {
    createMany: async ({ actors }) => actors.map((actor) => ({ id: "lead-1", name: actor.name })),
    tell: async () => {
      throw new Error("wake failed");
    },
    actors: async () => [
      { id: "lead-1", topics: ["crew.run-1"] },
      { id: "late-specialist", topics: ["crew.run-1"] },
      { id: "other", topics: ["crew.other"] },
    ],
    remove: async ({ id }) => {
      removed.push(id);
      return { removed: true };
    },
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await assert.rejects(
    () => new AsyncFunction("pi", "agents", launchCode("config.json"))(fakePi, fakeAgents),
    /wake failed/,
  );
  const failed = JSON.parse(files.get("roster.json"));
  assert.equal(failed.status, "failed");
  assert.deepEqual(failed.cleanedActorIds.sort(), ["late-specialist", "lead-1"]);
  assert.deepEqual(failed.cleanupFailures, []);
  assert.deepEqual(removed.sort(), ["late-specialist", "lead-1"]);
});

test("launch code uses Fabric APIs and relative config paths", () => {
  const code = launchCode(".custom/fabric/crew-launch/run-1.json");
  assert.match(code, /roster\.status !== 'queued'/);
  assert.match(code, /alreadyLaunched: true/);
  assert.match(code, /newText: '"status": "launching"'/);
  assert.match(code, /agents\.createMany\(\{ actors: \[\.\.\.cfg\.members, cfg\.lead\] \}\)/);
  assert.ok(!code.includes("supervisor"));
  assert.ok(!code.includes("BOOTSTRAP"));
  assert.match(source, /resultSummaryMaxBytes must be an integer/);
  assert.match(source, /resultSummaryMaxBytes: input\.resultSummaryMaxBytes \?\? null/);
  assert.match(source, /completionMode === "human-gated"/);
  assert.match(source, /leadTickTopic = `\$\{topic\}\.lead-tick`/);
  assert.match(source, /schedule: \{ topic: leadTickTopic, everyMs: monitorIntervalMs \}/);
  assert.match(source, /delivery: "followUp"/);
  assert.match(source, /triggerTurn: true/);
  assert.match(code, /agents\.tell\(\{ id: lead\.id, message: cfg\.assignment \}\)/);
  assert.doesNotMatch(code, /Continue the protocol from kickoff/);
  assert.match(code, /pi\.write\(\{ path: cfg\.rosterFile, text:/);
  assert.ok(!code.includes("content: JSON.stringify(roster"));
  assert.ok(!code.includes("agents.followUp"));
  assert.match(code, /status: 'started'/);
  assert.match(code, /roster\.status = 'failed'/);
  assert.match(code, /agents\.remove/);
  assert.match(code, /remove not confirmed/);
  assert.match(code, /cleanupFailures/);
  assert.ok(!code.includes("/Users/"));
  assert.ok(!code.includes("Workspace/"));
});
