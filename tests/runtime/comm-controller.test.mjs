import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { Runtime } from "../../.pi/extensions/runtime/lib/runtime.mjs";
import test from "node:test";
import WebSocket from "ws";
import { CommController } from "../../.pi/extensions/runtime/lib/comm-controller.mjs";

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
