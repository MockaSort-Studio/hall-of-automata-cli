import { strict as assert } from "node:assert";
import { test } from "node:test";
import { crewMonitorSnapshot } from "../../.pi/extensions/crew/lib/monitor-snapshot.mjs";

const roster = (overrides) => ({
  runId: "run-123456",
  status: "started",
  members: [
    { name: "architect-a", actorId: "actor-1", role: "specialist" },
    { name: "developer-b", actorId: "actor-2", role: "specialist" },
    { name: "developer-c", actorId: "actor-3", role: "specialist" },
  ],
  ...overrides,
});

test("crewMonitorSnapshot buckets automata by durable lifecycle state", () => {
  const snapshot = crewMonitorSnapshot(roster(), {
    lifecycleByActor: { "actor-1": "running", "actor-2": "PASS", "actor-3": "BLOCKED" },
    workerMetricsByActor: {},
  });
  assert.equal(snapshot.runId, "run-123456");
  assert.deepEqual(snapshot.counts, {
    queued: 0,
    running: 1,
    attention: 0,
    complete: 1,
    blocked: 1,
    failed: 0,
    total: 3,
  });
});

test("crewMonitorSnapshot defaults automata missing lifecycle entries to queued", () => {
  const snapshot = crewMonitorSnapshot(roster(), {});
  assert.equal(snapshot.counts.queued, 3);
  assert.equal(snapshot.counts.total, 3);
});

test("crewMonitorSnapshot buckets an actor with live worker-metrics evidence as running even without a terminal or running lifecycle entry", () => {
  const snapshot = crewMonitorSnapshot(roster(), {
    lifecycleByActor: {},
    workerMetricsByActor: {
      "actor-1": { turns: 2, toolCalls: 0 },
      "actor-2": { turns: 0, toolCalls: 3 },
      "actor-3": { turns: 0, toolCalls: 0 },
    },
  });
  assert.deepEqual(snapshot.counts, {
    queued: 1,
    running: 2,
    attention: 0,
    complete: 0,
    blocked: 0,
    failed: 0,
    total: 3,
  });
});

test("crewMonitorSnapshot keeps an actor queued when it has zero turns/events and no terminal status, even if a metrics record exists", () => {
  const snapshot = crewMonitorSnapshot(roster(), {
    lifecycleByActor: {},
    workerMetricsByActor: {
      "actor-1": { turns: 0, toolCalls: 0, toolErrors: 0, compactions: 0 },
    },
  });
  assert.equal(snapshot.counts.queued, 3);
  assert.equal(snapshot.counts.running, 0);
});

test("crewMonitorSnapshot lets an explicit terminal lifecycle status take precedence over worker-metrics evidence", () => {
  const snapshot = crewMonitorSnapshot(roster(), {
    lifecycleByActor: { "actor-1": "PASS" },
    workerMetricsByActor: {
      "actor-1": { turns: 5, toolCalls: 5 },
    },
  });
  assert.equal(snapshot.counts.complete, 1);
  assert.equal(snapshot.counts.running, 0);
});

test("crewMonitorSnapshot sums generated output tokens across worker metrics", () => {
  const snapshot = crewMonitorSnapshot(roster(), {
    lifecycleByActor: { "actor-1": "running", "actor-2": "running", "actor-3": "running" },
    workerMetricsByActor: {
      "actor-1": { providerTraffic: { generatedOutput: 100 } },
      "actor-2": { providerTraffic: { generatedOutput: 250 } },
      // actor-3 has no metrics on disk yet
    },
  });
  assert.equal(snapshot.totalGeneratedOutputTokens, 350);
});

test("crewMonitorSnapshot ignores non-finite or missing generatedOutput safely", () => {
  const snapshot = crewMonitorSnapshot(roster(), {
    workerMetricsByActor: {
      "actor-1": { providerTraffic: { generatedOutput: Number.NaN } },
      "actor-2": {},
      "actor-3": null,
    },
  });
  assert.equal(snapshot.totalGeneratedOutputTokens, 0);
});

test("crewMonitorSnapshot rejects an unknown lifecycle node rather than silently miscounting", () => {
  assert.throws(
    () => crewMonitorSnapshot(roster(), { lifecycleByActor: { "actor-1": "bogus" } }),
    /Unknown Crew lifecycle state: bogus/,
  );
});

test("crewMonitorSnapshot handles an empty or missing roster", () => {
  assert.equal(crewMonitorSnapshot(null), null);
  const empty = crewMonitorSnapshot(roster({ members: [] }));
  assert.equal(empty.counts.total, 0);
  assert.equal(empty.totalGeneratedOutputTokens, 0);
});
