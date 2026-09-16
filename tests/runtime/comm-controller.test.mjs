import { strict as assert } from "node:assert";
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
  const sender = await connect(port, "a");
  const recipient = await connect(port, "b");
  const delivered = receive(recipient);
  sender.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "emit",
      method: "comm.emit",
      params: { to: "b", payload: { marker: "atomic" } },
    }),
  );
  const accepted = await receive(sender);
  assert.equal(accepted.id, "emit");
  assert.equal(accepted.result.accepted, true);
  assert.match(accepted.result.id, /^[0-9a-f-]{36}$/);
  const message = await delivered;
  assert.equal(message.method, "comm.deliver");
  assert.equal(message.params.from, "a");
  assert.deepEqual(message.params.payload, { marker: "atomic" });
  sender.close();
  recipient.close();
  await comm.stop();
});

test("keeps a message until its recipient registers", async () => {
  const comm = new CommController();
  comm.registerActor("sender");
  comm.registerActor("later");
  const port = await comm.start();
  const sender = await connect(port, "sender");
  sender.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "queued",
      method: "comm.emit",
      params: { to: "later", payload: { marker: "queued" } },
    }),
  );
  await receive(sender);
  const recipient = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => recipient.once("open", resolve));
  const delivered = new Promise((resolve) =>
    recipient.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.method === "comm.deliver") resolve(message);
    }),
  );
  recipient.send(
    JSON.stringify({ jsonrpc: "2.0", id: "register", method: "comm.register", params: { actorId: "later" } }),
  );
  const message = await delivered;
  assert.deepEqual(message.params.payload, { marker: "queued" });
  sender.close();
  recipient.close();
  await comm.stop();
});

test("claims a queued Main message", () => {
  const comm = new CommController();
  comm.registerActor("agent");
  comm.emit("agent", "main", { marker: "main" });
  assert.deepEqual(comm.claim("main").payload, { marker: "main" });
  assert.equal(comm.claim("main"), undefined);
});

test("validates and correlates a required reply", () => {
  const comm = new CommController();
  comm.registerActor("a");
  comm.registerActor("b");
  const request = comm.emit("a", "b", { ask: "marker" }, true);
  const delivered = comm.claim("b");
  assert.equal(delivered.replyRequired, true);
  assert.equal(comm.emit("b", "a", { marker: "reply" }, false, request.id).accepted, true);
  assert.ok(comm.events().some((event) => event.type === "message_replied" && event.replyTo === request.id));
  assert.throws(() => comm.emit("b", "a", {}, false, "unknown"), /Unknown reply request/);
});

test("creates a flat v1 request envelope", () => {
  const comm = new CommController();
  comm.registerActor("to");
  const { id } = comm.emit("from", "to", { marker: "x" }, true);
  const message = comm.claim("to");
  assert.equal(message.v, 1);
  assert.equal(message.id, id);
  assert.equal(message.kind, "request");
  assert.equal(message.from, "from");
  assert.equal(message.to, "to");
  assert.ok(message.createdAt);
  assert.equal(message.replyRequired, true);
});
