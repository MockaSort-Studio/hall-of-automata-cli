import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CommController } from "../../.pi/extensions/runtime/lib/comm-controller.mjs";

const loadExtension = async (config) => {
  const dir = mkdtempSync(join(tmpdir(), "worker-comm-config-"));
  const configPath = join(dir, "config.json");
  writeFileSync(configPath, JSON.stringify(config));
  process.env.PI_CREW_WORKER_CONFIG = configPath;
  const module = await import(
    `../../.pi/extensions/runtime/lib/worker-comm-extension.mjs?t=${Date.now()}-${Math.random()}`
  );
  return module.default;
};
const waitFor = async (predicate) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for delivery");
};
const makeFakePi = () => {
  const handlers = new Map(),
    tools = new Map(),
    deliveries = [];
  return {
    handlers,
    tools,
    deliveries,
    on: (event, handler) => handlers.set(event, handler),
    registerTool: (tool) => tools.set(tool.name, tool),
    sendUserMessage: async (message) => deliveries.push(message),
  };
};
async function setup(t, commTools) {
  const comm = new CommController();
  comm.registerActor("lead");
  comm.registerActor("ns-worker");
  const port = await comm.start();
  const extension = await loadExtension({
    comm: { url: `ws://127.0.0.1:${port}`, actorId: "ns-worker", namespace: "ns" },
    initialTurn: "resident",
    task: "",
    commTools,
  });
  const pi = makeFakePi();
  extension(pi);
  await pi.handlers.get("session_start")();
  t.after(async () => {
    await pi.handlers.get("session_shutdown")();
    await comm.stop();
  });
  return { comm, pi };
}
test("comm_notify to main reaches main directly, unprefixed", async (t) => {
  const { comm, pi } = await setup(t, ["comm_notify", "comm_request", "comm_reply"]);
  const notify = await pi.tools.get("comm_notify").execute("call", { to: "main", payload: { ok: true } });
  assert.doesNotMatch(JSON.stringify(notify), /Unknown recipient/);
  const delivered = comm.claim("main");
  assert.equal(delivered?.to, "main");
  assert.equal(delivered?.from, "ns-worker");
});
test("acknowledges only after the Pi turn settles", async (t) => {
  const { comm, pi } = await setup(t);
  comm.emit("lead", "ns-worker", { ask: "respond" }, true);
  await waitFor(() => pi.deliveries.length === 1);
  assert.equal(
    comm.events().some((event) => event.type === "message_acknowledged"),
    false,
  );
  await pi.tools.get("comm_reply").execute("call", { payload: { ok: true } });
  await pi.handlers.get("agent_settled")();
  await waitFor(() => comm.events().some((event) => event.type === "message_acknowledged"));
});
test("keeps reply context for the current delivery", async (t) => {
  const { comm, pi } = await setup(t);
  const first = comm.emit("lead", "ns-worker", { ask: "first" }, true);
  await waitFor(() => pi.deliveries.length === 1);
  await pi.tools.get("comm_reply").execute("call", { payload: { marker: "first" } });
  await waitFor(() => comm.events().some((event) => event.replyTo === first.id));
  await pi.handlers.get("agent_settled")();
  await waitFor(() => comm.events().some((event) => event.type === "message_acknowledged"));
  comm.emit("lead", "ns-worker", { ask: "second" }, true);
  await waitFor(() => pi.deliveries.length === 2);
  const reply = await pi.tools.get("comm_reply").execute("call", { payload: { marker: "second" } });
  assert.doesNotMatch(JSON.stringify(reply), /does not require a reply/);
  await pi.handlers.get("agent_settled")();
});
test("specialists never receive comm_notify_all or comm_notify_many", async (t) => {
  const { pi } = await setup(t, ["comm_notify", "comm_request", "comm_reply"]);
  assert.ok(pi.tools.has("comm_notify"));
  assert.ok(!pi.tools.has("comm_notify_all"));
  assert.ok(!pi.tools.has("comm_notify_many"));
});
test("only a lead-granted worker receives comm_notify_all", async (t) => {
  const { pi } = await setup(t, ["comm_notify", "comm_notify_all", "comm_request", "comm_reply"]);
  assert.ok(pi.tools.has("comm_notify_all"));
  assert.ok(!pi.tools.has("comm_notify_many"));
});
