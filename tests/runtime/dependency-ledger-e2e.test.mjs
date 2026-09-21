// End-to-end coverage for the dependency ledger wired to a real
// CommController over WebSocket, the same transport worker actors and Main
// use in production (comm-controller.mjs / comm-client.mjs), not just the
// in-process observeRaw() unit coverage in dependency-ledger-wiring.test.mjs.
// Every assertion reads ledger.status()/snapshot() -- mechanical, structured
// state -- never report/prose, per docs/crew/comm-kickoff-dependency-design.md.
//
// Actor identity matters here, not just transport: a real worker's Comm
// actorId is namespace-qualified ("crew-<runId>-<handle>", never the bare
// handle -- see runtime.mjs's spawn() and worker-comm-extension.mjs's
// qualify()). An earlier version of this file registered/emitted with bare
// handles directly, which exercised the real WebSocket transport but not
// the real identity shape -- and missed a real bug where the ledger never
// actually transitioned any node in a live dispatch because of exactly
// this mismatch. This harness uses namespaced actorIds end to end.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CommController } from "../../.pi/extensions/runtime/lib/comm-controller.mjs";
import { connectComm } from "../../.pi/extensions/runtime/lib/comm-client.mjs";
import {
  attachRawEnvelopeObserver,
  seedDependencyLedgerFromSelectedCrew,
} from "../../.pi/extensions/crew/lib/dependency-ledger-wiring.mjs";

const NAMESPACE = "crew-run-e2e";
const qualified = (handle) => `${NAMESPACE}-${handle}`;

// Two parallel roots (alpha, beta), each with one dependent (gamma, delta)
// chained one level deep -- enough to exercise parallel roots, chained
// release, and independent blocked propagation without one path masking
// the other.
const selectedCrew = () => ({
  runId: "run-e2e",
  members: [
    { name: "alpha", handle: "developer-alpha-00", task: "Root A.", dependsOn: [] },
    { name: "beta", handle: "developer-beta-00", task: "Root B.", dependsOn: [] },
    { name: "gamma", handle: "developer-gamma-00", task: "Depends on alpha.", dependsOn: ["developer-alpha-00"] },
    { name: "delta", handle: "developer-delta-00", task: "Depends on beta.", dependsOn: ["developer-beta-00"] },
  ],
});

async function harness() {
  const comm = new CommController();
  for (const member of selectedCrew().members) comm.registerActor(qualified(member.handle));
  const port = await comm.start();
  const ledger = seedDependencyLedgerFromSelectedCrew(selectedCrew());
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm, NAMESPACE);
  const clients = {};
  for (const member of selectedCrew().members) {
    clients[member.handle] = await connectComm({ url: `ws://127.0.0.1:${port}`, actorId: qualified(member.handle) });
  }
  const main = await connectComm({ url: `ws://127.0.0.1:${port}`, actorId: "main" });
  return {
    comm,
    ledger,
    clients,
    main,
    async close() {
      unsubscribe();
      for (const client of Object.values(clients)) client.close();
      main.close();
      await comm.stop();
    },
  };
}

test("dependency-ledger-e2e: parallel roots both start from one structured kickoff", async () => {
  const { ledger, main, close } = await harness();
  try {
    await main.emit({
      to: qualified("developer-alpha-00"),
      payload: {
        kind: "kickoff",
        assignments: [
          { to: qualified("developer-alpha-00"), task: "Root A.", dependsOn: [] },
          { to: qualified("developer-beta-00"), task: "Root B.", dependsOn: [] },
        ],
      },
    });
    assert.equal(ledger.status("developer-alpha-00"), "running");
    assert.equal(ledger.status("developer-beta-00"), "running");
    assert.equal(ledger.status("developer-gamma-00"), "waiting");
    assert.equal(ledger.status("developer-delta-00"), "waiting");
  } finally {
    await close();
  }
});

test("dependency-ledger-e2e: a taskStatus:complete report releases the direct dependent (chained release)", async () => {
  const { ledger, clients, main, close } = await harness();
  try {
    ledger.start("developer-alpha-00");
    assert.equal(ledger.status("developer-gamma-00"), "waiting");
    await clients["developer-alpha-00"].emit({ to: "main", payload: { kind: "report", taskStatus: "complete" } });
    assert.equal(ledger.status("developer-alpha-00"), "complete");
    assert.equal(ledger.status("developer-gamma-00"), "ready");
    // Chained release: the ready dependent can now legally be started.
    await main.emit({ to: qualified("developer-gamma-00"), payload: { kind: "kickoff", task: "Depends on alpha." } });
    assert.equal(ledger.status("developer-gamma-00"), "running");
  } finally {
    await close();
  }
});

test("dependency-ledger-e2e: completion is directed to Main and the dependent only, an unrelated parallel actor's inbox stays empty", async () => {
  const { comm, clients, main, close } = await harness();
  try {
    const delivered = new Promise((resolve) => main.onDelivery(resolve));
    await clients["developer-alpha-00"].emit({ to: "main", payload: { kind: "report", taskStatus: "complete" } });
    const mainDelivery = await delivered;
    assert.equal(mainDelivery.payload.taskStatus, "complete");
    assert.equal(mainDelivery.from, qualified("developer-alpha-00"));
    // Directed completion recipients: Lead (main) got the report above;
    // beta/delta -- not gamma's dependency chain -- never receive anything
    // about alpha's completion.
    assert.equal(comm.claim(qualified("developer-beta-00")), undefined);
    assert.equal(comm.claim(qualified("developer-delta-00")), undefined);
  } finally {
    await close();
  }
});

test("dependency-ledger-e2e: taskStatus:blocked propagates to the dependent without affecting the unrelated parallel chain", async () => {
  const { ledger, clients, close } = await harness();
  try {
    ledger.start("developer-alpha-00");
    ledger.start("developer-beta-00");
    await clients["developer-beta-00"].emit({
      to: "main",
      payload: { kind: "report", taskStatus: "blocked", reason: "waiting on external input" },
    });
    assert.equal(ledger.status("developer-beta-00"), "blocked");
    assert.equal(ledger.status("developer-delta-00"), "blocked");
    // The unrelated alpha/gamma chain is untouched by beta's block.
    assert.equal(ledger.status("developer-alpha-00"), "running");
    assert.equal(ledger.status("developer-gamma-00"), "waiting");
  } finally {
    await close();
  }
});

test("dependency-ledger-e2e: a final resolved-state report reflects every terminal and live status via ledger.snapshot()", async () => {
  const { ledger, clients, close } = await harness();
  try {
    ledger.start("developer-alpha-00");
    ledger.start("developer-beta-00");
    await clients["developer-alpha-00"].emit({ to: "main", payload: { kind: "report", taskStatus: "complete" } });
    ledger.start("developer-gamma-00");
    await clients["developer-gamma-00"].emit({ to: "main", payload: { kind: "report", taskStatus: "complete" } });
    await clients["developer-beta-00"].emit({
      to: "main",
      payload: { kind: "report", taskStatus: "failed", reason: "unrecoverable" },
    });
    // Final resolved-state report: every node is either terminal or, for
    // one still-live node left deliberately unresolved, its accurate live
    // status -- never inferred from prose.
    assert.deepEqual(ledger.snapshot(), {
      "developer-alpha-00": "complete",
      "developer-beta-00": "failed",
      "developer-gamma-00": "complete",
      "developer-delta-00": "blocked",
    });
  } finally {
    await close();
  }
});
