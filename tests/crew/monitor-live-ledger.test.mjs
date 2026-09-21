import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createLiveLedgerTracker } from "../../.pi/extensions/crew/lib/monitor-live-ledger.mjs";

const selectedCrew = (runId = "run-1") => ({
  runId,
  members: [
    { name: "alpha", handle: "developer-alpha-00", task: "Do alpha work.", dependsOn: [] },
    { name: "bravo", handle: "developer-bravo-00", task: "Do bravo work.", dependsOn: ["developer-alpha-00"] },
  ],
});

// A minimal fake Runtime: records every observeRawComm handler so the test
// can push envelopes into it directly, the same shape attachRawEnvelopeObserver
// expects from a CommController.
function fakeRuntime() {
  const handlers = new Set();
  return {
    observeRawComm(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    push(envelope) {
      for (const handler of handlers) handler(envelope);
    },
    handlerCount: () => handlers.size,
  };
}

test("ledgerFor seeds a ledger once per run and reuses it on repeat calls with the same plan", () => {
  const runtime = fakeRuntime();
  const tracker = createLiveLedgerTracker(runtime);
  const ledger = tracker.ledgerFor(selectedCrew());
  assert.equal(tracker.ledgerFor(selectedCrew()), ledger);
  assert.equal(runtime.handlerCount(), 1);
});

test("ledgerFor stays current with live kickoff/report envelopes, not just structural state", () => {
  const runtime = fakeRuntime();
  const tracker = createLiveLedgerTracker(runtime);
  const ledger = tracker.ledgerFor(selectedCrew());
  assert.equal(ledger.status("developer-alpha-00"), "waiting");
  runtime.push({ payload: { kind: "kickoff", assignments: [{ to: "developer-alpha-00" }] } });
  assert.equal(ledger.status("developer-alpha-00"), "running");
  runtime.push({ from: "developer-alpha-00", payload: { kind: "report", taskStatus: "complete" } });
  assert.equal(ledger.status("developer-alpha-00"), "complete");
  assert.equal(ledger.status("developer-bravo-00"), "ready");
});

// Regression: a real worker's Comm actorId is namespace-qualified
// ("crew-<runId>-<handle>"), never the bare handle used above. Without
// stripping that prefix before matching, ledgerFor's subscription would
// look correct in every test using bare handles directly while never
// actually transitioning any node in a real dispatch -- this exact gap
// shipped and went unnoticed because no test exercised the real shape.
test("ledgerFor strips the run's namespace prefix from real, namespace-qualified envelope to/from fields", () => {
  const runtime = fakeRuntime();
  const tracker = createLiveLedgerTracker(runtime);
  const ledger = tracker.ledgerFor(selectedCrew("run-1"));
  runtime.push({
    payload: { kind: "kickoff", assignments: [{ to: "crew-run-1-developer-alpha-00" }] },
  });
  assert.equal(ledger.status("developer-alpha-00"), "running");
  runtime.push({ from: "crew-run-1-developer-alpha-00", payload: { kind: "report", taskStatus: "complete" } });
  assert.equal(ledger.status("developer-alpha-00"), "complete");
});

test("ledgerFor rebuilds and unsubscribes the previous run when the plan's runId changes", () => {
  const runtime = fakeRuntime();
  const tracker = createLiveLedgerTracker(runtime);
  const first = tracker.ledgerFor(selectedCrew("run-1"));
  const second = tracker.ledgerFor(selectedCrew("run-2"));
  assert.notEqual(first, second);
  assert.equal(runtime.handlerCount(), 1);
});

test("ledgerFor tears down and returns undefined when there is no plan", () => {
  const runtime = fakeRuntime();
  const tracker = createLiveLedgerTracker(runtime);
  tracker.ledgerFor(selectedCrew());
  assert.equal(tracker.ledgerFor(null), undefined);
  assert.equal(runtime.handlerCount(), 0);
});

test("stop() tears down the current subscription", () => {
  const runtime = fakeRuntime();
  const tracker = createLiveLedgerTracker(runtime);
  tracker.ledgerFor(selectedCrew());
  tracker.stop();
  assert.equal(runtime.handlerCount(), 0);
});
