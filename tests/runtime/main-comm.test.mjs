import { strict as assert } from "node:assert";
import test from "node:test";
import { Runtime } from "../../.pi/extensions/hall-crew/crew-runtime/lib/runtime.mjs";
import { connectComm } from "../../.pi/extensions/hall-crew/crew-runtime/lib/comm-client.mjs";

const runId = "11111111-1111-1111-1111-111111111111";
const namespace = `crew-${runId}`;
const handle = "developer-snowball-00";
const actorId = `${namespace}-${handle}`;

async function setup(t) {
  const runtime = new Runtime(process.cwd());
  const comm = await runtime.startComm([actorId], [], { namespace, members: [{ handle, dependsOn: [], task: "" }] });
  const worker = await connectComm({ ...comm, actorId, namespace });
  t.after(async () => {
    worker.close();
    await runtime.stop();
  });
  return { runtime, worker };
}

test("Main sends one handle-resolved message and broadcasts to the run", async (t) => {
  const { runtime, worker } = await setup(t);
  const deliveries = [];
  worker.onDelivery((message) => deliveries.push(message));
  await runtime.sendMember(runId, handle, { kind: "task", value: 1 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(deliveries[0]?.payload, { kind: "task", value: 1 });
  await worker.acknowledge(deliveries[0].id);
  await runtime.broadcastRun(runId, { kind: "notice" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(deliveries[1]?.payload, { kind: "notice" });
});

test("Main receives a request and only its correlated reply acknowledges it", async (t) => {
  const { runtime, worker } = await setup(t);
  const replies = [];
  worker.onDelivery((message) => replies.push(message));
  await worker.emit({ to: "main", payload: { question: "continue?" }, replyRequired: true });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const request = await runtime.receive();
  assert.equal(request?.replyRequired, true);
  await runtime.replyFromMain(request.id, { answer: "yes" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(replies[0]?.replyTo, request.id);
  assert.deepEqual(replies[0]?.payload, { answer: "yes" });
});
