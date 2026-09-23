import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { Runtime } from "../../.pi/extensions/runtime/lib/runtime.mjs";
import test from "node:test";
import WebSocket from "ws";
import { CommController } from "../../.pi/extensions/runtime/lib/comm-controller.mjs";
import { connectComm } from "../../.pi/extensions/runtime/lib/comm-client.mjs";

const receive = (socket) => new Promise((resolve) => socket.once("message", (raw) => resolve(JSON.parse(String(raw)))));
const connect = async (port, actorId) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => socket.once("open", resolve));
  socket.send(JSON.stringify({ jsonrpc: "2.0", id: "register", method: "comm.register", params: { actorId } }));
  await receive(socket);
  return socket;
};

test("routes an atomic payload through a per-controller mailbox", async () => {
  const comm = new CommController();
  comm.registerActor("a");
  comm.registerActor("b");
  const port = await comm.start();
  const sender = await connect(port, "a"),
    recipient = await connect(port, "b"),
    delivered = receive(recipient);
  sender.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "emit",
      method: "comm.emit",
      params: { to: "b", payload: { marker: "atomic" } },
    }),
  );
  assert.equal((await receive(sender)).result.accepted, true);
  assert.deepEqual((await delivered).params.payload, { marker: "atomic" });
  sender.close();
  recipient.close();
  await comm.stop();
});
test("keeps a message until its recipient registers", () => {
  const comm = new CommController();
  comm.registerActor("sender");
  comm.registerActor("later");
  comm.emit("sender", "later", { marker: "queued" });
  assert.deepEqual(comm.claim("later").payload, { marker: "queued" });
});
test("claims a queued Main message", () => {
  const comm = new CommController();
  comm.registerActor("agent");
  comm.emit("agent", "main", { marker: "main" });
  assert.deepEqual(comm.claim("main").payload, { marker: "main" });
});
test("validates and correlates a required reply", () => {
  const comm = new CommController();
  comm.registerActor("a");
  comm.registerActor("b");
  const request = comm.emit("a", "b", { ask: "marker" }, true);
  comm.claim("b");
  assert.equal(comm.emit("b", "a", { marker: "reply" }, false, request.id).accepted, true);
});
test("creates a flat v1 request envelope", () => {
  const comm = new CommController();
  comm.registerActor("to");
  const { id } = comm.emit("from", "to", { marker: "x" }, true);
  assert.equal(comm.claim("to").id, id);
});
test("publishes envelopes and injects human requests to the selected actor", async () => {
  const comm = new CommController();
  comm.registerActor("lead");
  const observed = [];
  const unsubscribe = comm.subscribe((message) => observed.push(message));
  const accepted = comm.injectHuman({ to: "lead", body: "Please verify this.", author: "human", externalId: "c1" });
  await new Promise((resolve) => setImmediate(resolve));
  const message = comm.claim("lead");
  assert.equal(observed[0].id, accepted.id);
  assert.equal(message.kind, "request");
  assert.equal(message.from, "human:github-discussion");
  assert.deepEqual(message.payload, {
    message: "Please verify this.",
    author: "human",
    externalId: "c1",
  });
  assert.deepEqual(observed[0], {
    id: accepted.id,
    kind: "request",
    from: "human:github-discussion",
    to: "lead",
    message: "Please verify this.",
    replyTo: undefined,
  });
  unsubscribe();
});
test("projects a human-readable structured payload for adapters", () => {
  const comm = new CommController();
  comm.registerActor("to");
  const observed = [];
  const unsubscribe = comm.subscribe((message) => observed.push(message));
  comm.emit("from", "to", { kind: "complete", summary: "Validated the dependency ledger." });
  assert.equal(observed[0].message, "Validated the dependency ledger.");
  unsubscribe();
});

test("gives internal observers the raw envelope, not the adapter projection", () => {
  const comm = new CommController();
  comm.registerActor("to");
  const observed = [];
  const unsubscribe = comm.observeRaw((envelope) => observed.push(envelope));
  const { id } = comm.emit("lead", "to", { kind: "kickoff", assignments: [{ to: "to", task: "x", dependsOn: [] }] });
  assert.equal(observed.length, 1);
  assert.equal(observed[0].id, id);
  assert.equal(observed[0].kind, "notify");
  assert.deepEqual(observed[0].payload, {
    kind: "kickoff",
    assignments: [{ to: "to", task: "x", dependsOn: [] }],
  });
  unsubscribe();
});

test("comm.observe_raw pushes the unfiltered envelope stream over the same socket, not the adapter projection", async () => {
  const comm = new CommController();
  comm.registerActor("a");
  comm.registerActor("b");
  const port = await comm.start();
  const observer = await connect(port, "a");
  observer.send(JSON.stringify({ jsonrpc: "2.0", id: "observe", method: "comm.observe_raw", params: {} }));
  assert.deepEqual((await receive(observer)).result, { observing: true });
  const pushed = receive(observer);
  comm.emit("b", "a", { kind: "kickoff", task: "go" });
  const envelope = (await pushed).params;
  assert.equal(envelope.kind, "notify");
  assert.deepEqual(envelope.payload, { kind: "kickoff", task: "go" });
  observer.close();
  await comm.stop();
});
test("comm.observe_raw is idempotent per socket and stops after disconnect", async () => {
  const comm = new CommController();
  comm.registerActor("a");
  const port = await comm.start();
  const observer = await connect(port, "a");
  observer.send(JSON.stringify({ jsonrpc: "2.0", id: "observe", method: "comm.observe_raw", params: {} }));
  await receive(observer);
  observer.send(JSON.stringify({ jsonrpc: "2.0", id: "observe2", method: "comm.observe_raw", params: {} }));
  await receive(observer);
  observer.close();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.doesNotThrow(() => comm.emit("a", "main", { kind: "kickoff", task: "go" }));
  await comm.stop();
});

test("stop() resolves quickly even when a connected socket never completed comm.register (real, reproduced hang)", async () => {
  const comm = new CommController();
  const port = await comm.start();
  // A raw socket that connects but never sends "comm.register" is never
  // added to CommController's own #connections bookkeeping -- exactly the
  // gap that let a real comm-server.mjs child process outlive a killed
  // test: the old stop() only closed *tracked* connections, then awaited
  // wss.close(), which never resolves while any client (tracked or not)
  // is still open.
  const unregistered = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => unregistered.once("open", resolve));
  const start = Date.now();
  await comm.stop();
  assert.ok(Date.now() - start < 2_500, "stop() must resolve deterministically, not hang on an untracked socket");
});
test("stop() resolves quickly even when a registered socket is killed without a close handshake", async () => {
  const comm = new CommController();
  comm.registerActor("a");
  const port = await comm.start();
  const socket = await connect(port, "a");
  // .terminate() drops the TCP connection immediately, the same way a
  // SIGKILLed worker process would, without ever sending a close frame.
  socket.terminate();
  const start = Date.now();
  await comm.stop();
  assert.ok(Date.now() - start < 2_500, "stop() must resolve deterministically, not hang on a dead peer");
});

test("comm.state_snapshot returns the typed plan shape registered via comm.register_plan", async () => {
  const comm = new CommController();
  comm.registerActor("crew-run-1-developer-alpha-00");
  const port = await comm.start();
  const client = await connectComm({ url: `ws://127.0.0.1:${port}`, actorId: "main" });
  await client.registerPlan("crew-run-1", [{ handle: "developer-alpha-00", dependsOn: [], task: "Do alpha work." }]);
  const snapshot = await client.getStateSnapshot("crew-run-1");
  assert.equal(snapshot.namespace, "crew-run-1");
  assert.deepEqual(snapshot.nodes, [
    { handle: "developer-alpha-00", status: "waiting", dependsOn: [], task: "Do alpha work." },
  ]);
  client.close();
  await comm.stop();
});
test("comm.state_snapshot is undefined for a namespace with no registered plan", async () => {
  const comm = new CommController();
  const port = await comm.start();
  const client = await connectComm({ url: `ws://127.0.0.1:${port}`, actorId: "main" });
  assert.equal(await client.getStateSnapshot("crew-unknown"), undefined);
  client.close();
  await comm.stop();
});
test("comm.observe_state pushes a compact status update over the same socket as live envelopes land", async () => {
  const comm = new CommController();
  comm.registerActor("crew-run-1-developer-alpha-00");
  const port = await comm.start();
  const url = `ws://127.0.0.1:${port}`;
  const main = await connectComm({ url, actorId: "main" });
  await main.registerPlan("crew-run-1", [{ handle: "developer-alpha-00", dependsOn: [], task: "x" }]);
  const observer = await connectComm({ url, actorId: "observer" });
  const updates = [];
  observer.observeState("crew-run-1", (nodes) => updates.push(nodes));
  await new Promise((resolve) => setTimeout(resolve, 20));
  await main.emit({
    to: "crew-run-1-developer-alpha-00",
    payload: { kind: "kickoff", assignments: [{ to: "crew-run-1-developer-alpha-00" }] },
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(updates.length >= 1);
  assert.deepEqual(updates.at(-1), [{ handle: "developer-alpha-00", status: "running" }]);
  main.close();
  observer.close();
  await comm.stop();
});

test("rejects duplicate Crew actor IDs before spawning", async () => {
  const runtime = new Runtime(process.cwd());
  await assert.rejects(
    runtime.launchCrew([
      { name: "a", actorId: "same", task: "x" },
      { name: "b", actorId: "same", task: "x" },
    ]),
    /unique/,
  );
  await runtime.stop();
});
test("Runtime.observeRawComm streams raw envelopes over Main's own Comm connection", async () => {
  const runtime = new Runtime(process.cwd());
  await runtime.startComm(["peer"]);
  const observed = [];
  const unsubscribe = runtime.observeRawComm((envelope) => observed.push(envelope));
  await runtime.send("peer", { kind: "kickoff", task: "go" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(observed.length, 1);
  assert.equal(observed[0].to, "peer");
  assert.deepEqual(observed[0].payload, { kind: "kickoff", task: "go" });
  unsubscribe();
  await runtime.stop();
});
test("Runtime.observeRawComm is a no-op unsubscribe before Comm has started", () => {
  const runtime = new Runtime(process.cwd());
  const unsubscribe = runtime.observeRawComm(() => {});
  assert.doesNotThrow(() => unsubscribe());
});

test("launchCrew registers the plan it is given, so the Comm server owns that run's typed state from the start", async () => {
  const runtime = new Runtime(process.cwd()),
    prefix = `plan-${randomUUID()}`;
  try {
    await runtime.launchCrew(
      [
        { name: "developer-a-00", actorId: `${prefix}-a`, task: "Reply done.", namespace: prefix },
        { name: "developer-b-00", actorId: `${prefix}-b`, task: "Reply done.", namespace: prefix },
      ],
      [],
      {
        namespace: prefix,
        members: [
          { handle: "developer-a-00", dependsOn: [], task: "first" },
          { handle: "developer-b-00", dependsOn: ["developer-a-00"], task: "second" },
        ],
      },
    );
    const client = await connectComm({ url: (await runtime.startComm()).url, actorId: `observer-${prefix}` });
    const snapshot = await client.getStateSnapshot(prefix);
    assert.deepEqual(
      snapshot.nodes.map((node) => [node.handle, node.status]),
      [
        ["developer-a-00", "waiting"],
        ["developer-b-00", "waiting"],
      ],
    );
    client.close();
  } finally {
    await runtime.stop();
  }
});

test("launchCrew without a plan registers nothing (plan is optional)", async () => {
  const runtime = new Runtime(process.cwd()),
    prefix = `noplan-${randomUUID()}`;
  try {
    await runtime.launchCrew([{ name: "developer-a-00", actorId: `${prefix}-a`, task: "Reply done." }]);
    const client = await connectComm({ url: (await runtime.startComm()).url, actorId: `observer-${prefix}` });
    assert.equal(await client.getStateSnapshot(prefix), undefined);
    client.close();
  } finally {
    await runtime.stop();
  }
});

test("launchCrew starts isolated agents and Runtime stop removes them", async () => {
  const runtime = new Runtime(process.cwd()),
    prefix = `launch-${randomUUID()}`;
  const result = await runtime.launchCrew([
    { name: "a", actorId: `${prefix}-a`, task: "Reply done." },
    { name: "b", actorId: `${prefix}-b`, task: "Reply done." },
  ]);
  assert.equal((await runtime.list()).length, 2);
  const cleanup = await runtime.stop();
  assert.equal(cleanup.removals.filter((item) => item.removed).length, 2);
});
