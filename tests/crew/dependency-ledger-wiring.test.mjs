import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CommController } from "../../.pi/extensions/runtime/lib/comm-controller.mjs";
import { createDependencyLedger } from "../../.pi/extensions/crew/lib/dependency-ledger.mjs";
import {
  attachRawEnvelopeObserver,
  readableDependencyLedgerSnapshot,
  seedDependencyLedgerFromSelectedCrew,
} from "../../.pi/extensions/crew/lib/dependency-ledger-wiring.mjs";

const selectedCrew = () => ({
  runId: "run-1",
  topic: "crew.run-1",
  members: [
    { name: "alpha", role: "developer", handle: "developer-alpha-00", task: "Do alpha work.", dependsOn: [] },
    {
      name: "bravo",
      role: "developer",
      handle: "developer-bravo-00",
      task: "Do bravo work.",
      dependsOn: ["developer-alpha-00"],
    },
  ],
});

test("seedDependencyLedgerFromSelectedCrew records every member and its dependsOn edges", () => {
  const ledger = seedDependencyLedgerFromSelectedCrew(selectedCrew());
  assert.deepEqual(ledger.nodes().sort(), ["developer-alpha-00", "developer-bravo-00"]);
  assert.deepEqual(ledger.dependenciesOf("developer-bravo-00"), ["developer-alpha-00"]);
  assert.equal(ledger.status("developer-alpha-00"), "waiting");
  assert.equal(ledger.status("developer-bravo-00"), "waiting");
});

test("seedDependencyLedgerFromSelectedCrew tolerates an empty or missing member list", () => {
  const ledger = seedDependencyLedgerFromSelectedCrew({ members: [] });
  assert.deepEqual(ledger.nodes(), []);
  assert.deepEqual(seedDependencyLedgerFromSelectedCrew({}).nodes(), []);
});

test("readableDependencyLedgerSnapshot merges ledger status with recorded task text", () => {
  const ledger = seedDependencyLedgerFromSelectedCrew(selectedCrew());
  const snapshot = readableDependencyLedgerSnapshot(ledger, selectedCrew().members);
  assert.deepEqual(
    snapshot.sort((a, b) => a.handle.localeCompare(b.handle)),
    [
      { handle: "developer-alpha-00", status: "waiting", dependsOn: [], task: "Do alpha work." },
      {
        handle: "developer-bravo-00",
        status: "waiting",
        dependsOn: ["developer-alpha-00"],
        task: "Do bravo work.",
      },
    ],
  );
});

test("attachRawEnvelopeObserver starts a ready node when a kickoff envelope names it as the recipient", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go" });
  assert.equal(ledger.status("developer-alpha-00"), "running");
  unsubscribe();
});

test("attachRawEnvelopeObserver starts every ready assignment named in a structured kickoff", () => {
  const ledger = seedDependencyLedgerFromSelectedCrew(selectedCrew());
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("lead", "developer-alpha-00", {
    kind: "kickoff",
    assignments: [
      { to: "developer-alpha-00", task: "Do alpha work.", dependsOn: [] },
      { to: "developer-bravo-00", task: "Do bravo work.", dependsOn: ["developer-alpha-00"] },
    ],
  });
  assert.equal(ledger.status("developer-alpha-00"), "running");
  assert.equal(ledger.status("developer-bravo-00"), "waiting");
  unsubscribe();
});

test("attachRawEnvelopeObserver ignores envelopes for handles the ledger does not track", () => {
  const ledger = createDependencyLedger();
  const comm = new CommController();
  comm.registerActor("stranger");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  assert.doesNotThrow(() => comm.emit("main", "stranger", { kind: "kickoff", task: "go" }));
  unsubscribe();
});

test("attachRawEnvelopeObserver ignores non-kickoff and malformed payloads", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("main", "developer-alpha-00", { kind: "notify", message: "hello" });
  comm.emit("main", "developer-alpha-00", "a plain string payload");
  assert.equal(ledger.status("developer-alpha-00"), "waiting");
  unsubscribe();
});

test("attachRawEnvelopeObserver ignores a second kickoff once a node is already running", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go" });
  assert.doesNotThrow(() => comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go again" }));
  assert.equal(ledger.status("developer-alpha-00"), "running");
  unsubscribe();
});
