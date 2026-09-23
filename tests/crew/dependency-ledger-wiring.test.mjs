import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CommController } from "../../.pi/extensions/runtime/lib/comm-controller.mjs";
import { createDependencyLedger } from "../../.pi/extensions/crew/lib/dependency-ledger.mjs";
import {
  attachRawEnvelopeObserver,
  ledgerStatusByActor,
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

// Regression: a real worker's Comm actorId is namespace-qualified
// ("crew-<runId>-<handle>"), not the bare handle the ledger is seeded
// with. Every other test in this file uses bare handles directly and
// would pass even if namespace stripping were silently removed --this one
// specifically exercises the real, qualified shape.
test("attachRawEnvelopeObserver strips a namespace prefix from envelope to/from before matching the ledger", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  const comm = new CommController();
  comm.registerActor("crew-run-1-developer-alpha-00");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm, "crew-run-1");
  comm.emit("main", "crew-run-1-developer-alpha-00", { kind: "kickoff", task: "go" });
  assert.equal(ledger.status("developer-alpha-00"), "running");
  comm.emit("crew-run-1-developer-alpha-00", "main", { kind: "report", taskStatus: "complete" });
  assert.equal(ledger.status("developer-alpha-00"), "complete");
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

test("attachRawEnvelopeObserver completes a running node when its sender reports taskStatus complete", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  comm.registerActor("main");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go" });
  comm.emit("developer-alpha-00", "main", { kind: "report", taskStatus: "complete", summary: "done" });
  assert.equal(ledger.status("developer-alpha-00"), "complete");
  unsubscribe();
});

test("attachRawEnvelopeObserver releases dependents once the prerequisite's report marks it complete", () => {
  const ledger = seedDependencyLedgerFromSelectedCrew(selectedCrew());
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  comm.registerActor("main");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go" });
  assert.equal(ledger.status("developer-bravo-00"), "waiting");
  comm.emit("developer-alpha-00", "main", { kind: "report", taskStatus: "complete" });
  assert.equal(ledger.status("developer-alpha-00"), "complete");
  assert.equal(ledger.status("developer-bravo-00"), "ready");
  unsubscribe();
});

test("attachRawEnvelopeObserver fails a running node when its sender reports taskStatus failed", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  comm.registerActor("main");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go" });
  comm.emit("developer-alpha-00", "main", { kind: "report", taskStatus: "failed", reason: "broke" });
  assert.equal(ledger.status("developer-alpha-00"), "failed");
  unsubscribe();
});

test("attachRawEnvelopeObserver blocks a node when its sender reports taskStatus blocked and propagates to dependents", () => {
  const ledger = seedDependencyLedgerFromSelectedCrew(selectedCrew());
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  comm.registerActor("main");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go" });
  comm.emit("developer-alpha-00", "main", { kind: "report", taskStatus: "blocked", reason: "stuck" });
  assert.equal(ledger.status("developer-alpha-00"), "blocked");
  assert.equal(ledger.status("developer-bravo-00"), "blocked");
  unsubscribe();
});

test("attachRawEnvelopeObserver ignores unknown senders and maps structured lifecycle status", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  comm.registerActor("stranger");
  comm.registerActor("main");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  assert.doesNotThrow(() => comm.emit("stranger", "main", { kind: "report", taskStatus: "complete" }));
  comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go" });
  assert.doesNotThrow(() => comm.emit("developer-alpha-00", "main", { kind: "report", taskStatus: "BLOCKED" }));
  assert.equal(ledger.status("developer-alpha-00"), "running");
  comm.emit("developer-alpha-00", "main", { kind: "report", status: "BLOCKED" });
  assert.equal(ledger.status("developer-alpha-00"), "blocked");
  unsubscribe();
});

test("attachRawEnvelopeObserver ignores a report with no structured status field", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  const comm = new CommController();
  comm.registerActor("developer-alpha-00");
  comm.registerActor("main");
  const unsubscribe = attachRawEnvelopeObserver(ledger, comm);
  comm.emit("main", "developer-alpha-00", { kind: "kickoff", task: "go" });
  assert.doesNotThrow(() => comm.emit("developer-alpha-00", "main", { kind: "report", summary: "still working" }));
  assert.equal(ledger.status("developer-alpha-00"), "running");
  unsubscribe();
});

test("ledgerStatusByActor folds live ledger status into a roster's actorId keying", () => {
  const ledger = createDependencyLedger();
  ledger.addNode("developer-alpha-00");
  ledger.start("developer-alpha-00");
  ledger.complete("developer-alpha-00");
  const members = [
    { actorId: "actor-1", name: "developer-alpha-00" },
    { actorId: "actor-2", name: "developer-bravo-00" }, // not a ledger node -- omitted, not guessed
    { actorId: "actor-3" }, // no name -- omitted
  ];
  assert.deepEqual(ledgerStatusByActor(ledger, members), { "actor-1": "complete" });
});

test("ledgerStatusByActor tolerates a missing ledger or member list", () => {
  assert.deepEqual(ledgerStatusByActor(undefined, [{ actorId: "actor-1", name: "developer-alpha-00" }]), {});
  assert.deepEqual(ledgerStatusByActor(createDependencyLedger()), {});
});
