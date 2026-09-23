// Pure unit coverage of comm-state-owner.mjs against a minimal fake "comm"
// (just observeRaw()), independent of any real WebSocket transport -- the
// WS-level "comm.register_plan"/"comm.state_snapshot"/"comm.observe_state"
// wiring is covered separately in tests/runtime/comm-controller.test.mjs.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createCommStateOwner } from "../../.pi/extensions/crew/lib/comm-state-owner.mjs";

function fakeComm() {
  const subscribers = new Set();
  return {
    observeRaw: (handler) => {
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    },
    emit: (envelope) => {
      for (const subscriber of subscribers) subscriber(envelope);
    },
  };
}

const members = [
  { handle: "developer-alpha-00", task: "Do alpha work.", dependsOn: [] },
  { handle: "developer-bravo-00", task: "Do bravo work.", dependsOn: ["developer-alpha-00"] },
];

test("registerPlan seeds a typed snapshot from the static plan shape", () => {
  const owner = createCommStateOwner(fakeComm());
  owner.registerPlan("crew-run-1", members);
  const snapshot = owner.snapshot("crew-run-1");
  assert.equal(snapshot.namespace, "crew-run-1");
  assert.deepEqual(
    snapshot.nodes.map((node) => [node.handle, node.status, node.dependsOn, node.task]),
    [
      ["developer-alpha-00", "waiting", [], "Do alpha work."],
      ["developer-bravo-00", "waiting", ["developer-alpha-00"], "Do bravo work."],
    ],
  );
});

test("registerPlan is idempotent per namespace and never discards live ledger state", () => {
  const comm = fakeComm();
  const owner = createCommStateOwner(comm);
  owner.registerPlan("crew-run-1", members);
  comm.emit({
    kind: "notify",
    from: "lead",
    to: "crew-run-1-developer-alpha-00",
    payload: { kind: "kickoff", assignments: [{ to: "crew-run-1-developer-alpha-00" }] },
  });
  owner.registerPlan("crew-run-1", []); // repeat call, e.g. a retried registration
  const snapshot = owner.snapshot("crew-run-1");
  assert.equal(snapshot.nodes.find((node) => node.handle === "developer-alpha-00").status, "running");
});

test("snapshot returns undefined for an unregistered namespace", () => {
  const owner = createCommStateOwner(fakeComm());
  assert.equal(owner.snapshot("crew-unknown"), undefined);
});

test("live envelopes drive the ledger and subscribe() emits a compact status update for every change", () => {
  const comm = fakeComm();
  const owner = createCommStateOwner(comm);
  owner.registerPlan("crew-run-1", members);
  const updates = [];
  const unsubscribe = owner.subscribe("crew-run-1", (update) => updates.push(update));

  comm.emit({
    kind: "notify",
    from: "lead",
    to: "crew-run-1-developer-alpha-00",
    payload: { kind: "kickoff", assignments: [{ to: "crew-run-1-developer-alpha-00" }] },
  });
  assert.ok(updates.length >= 1);
  const afterKickoff = updates.at(-1);
  assert.deepEqual(
    afterKickoff.find((node) => node.handle === "developer-alpha-00"),
    { handle: "developer-alpha-00", status: "running" },
  );

  comm.emit({
    kind: "notify",
    from: "crew-run-1-developer-alpha-00",
    to: "main",
    payload: { kind: "report", taskStatus: "complete" },
  });
  const afterComplete = updates.at(-1);
  assert.equal(afterComplete.find((node) => node.handle === "developer-alpha-00").status, "complete");
  assert.equal(afterComplete.find((node) => node.handle === "developer-bravo-00").status, "ready");

  unsubscribe();
});

test("subscribe on an unregistered namespace returns a no-op unsubscribe", () => {
  const owner = createCommStateOwner(fakeComm());
  const unsubscribe = owner.subscribe("crew-unknown", () => assert.fail("must never be called"));
  assert.doesNotThrow(() => unsubscribe());
});

test("release stops delivering further updates for that namespace", () => {
  const comm = fakeComm();
  const owner = createCommStateOwner(comm);
  owner.registerPlan("crew-run-1", members);
  const updates = [];
  owner.subscribe("crew-run-1", (update) => updates.push(update));
  owner.release("crew-run-1");
  comm.emit({
    kind: "notify",
    from: "lead",
    to: "crew-run-1-developer-alpha-00",
    payload: { kind: "kickoff", assignments: [{ to: "crew-run-1-developer-alpha-00" }] },
  });
  assert.equal(updates.length, 0);
  assert.equal(owner.snapshot("crew-run-1"), undefined);
});
