// Wires the pure dependency-ledger.mjs DAG to two concrete Crew data
// sources: the durable member list recorded in selected_crew_<uuid>.json
// (task/dependsOn edges) and CommController's raw envelope stream (state
// transitions). Neither source alone is enough: the JSON file gives the
// static plan shape, the raw envelopes give live activity. No I/O lives
// here; callers read/parse the JSON and own the CommController instance.
import { createDependencyLedger } from "./dependency-ledger.mjs";

// seedDependencyLedgerFromSelectedCrew builds (or extends) a ledger from a
// selected_crew_<uuid>.json shape: { members: [{ handle, dependsOn }] }.
// Every member becomes a node before any edge is added, so ordering within
// the member list does not matter.
export function seedDependencyLedgerFromSelectedCrew(selected, ledger = createDependencyLedger()) {
  const members = Array.isArray(selected?.members) ? selected.members : [];
  for (const member of members) ledger.addNode(member.handle);
  for (const member of members) {
    for (const dependency of member.dependsOn || []) ledger.addDependency(member.handle, dependency);
  }
  return ledger;
}

// readableDependencyLedgerSnapshot folds live ledger status back together
// with the static task text the ledger itself does not store, for display
// (e.g. a future Plan tab). `members` is the same selected_crew member list
// used to seed the ledger.
export function readableDependencyLedgerSnapshot(ledger, members = []) {
  const taskByHandle = new Map(members.map((member) => [member.handle, member.task ?? ""]));
  return ledger.nodes().map((handle) => ({
    handle,
    status: ledger.status(handle),
    dependsOn: ledger.dependenciesOf(handle),
    task: taskByHandle.get(handle) ?? "",
  }));
}

// ledgerStatusByActor folds live ledger status into a roster's actorId
// keying instead of the ledger's own handle keying, for callers (the Crew
// monitor footer/Automata tab) that key everything else by actorId. Only
// includes a member the ledger actually tracks (member.name matches a
// ledger node's handle, e.g. "developer-snowball-00") -- absent or
// not-yet-tracked members are simply omitted, never guessed.
export function ledgerStatusByActor(ledger, members = []) {
  const byActor = {};
  if (!ledger) return byActor;
  for (const member of members) {
    if (member?.actorId && member?.name && ledger.has(member.name))
      byActor[member.actorId] = ledger.status(member.name);
  }
  return byActor;
}

// A structured kickoff names its recipients explicitly via
// payload.assignments (comm-native kickoff design); a plain kickoff
// broadcast (today's no-Lead path) has no assignments and simply targets
// the envelope's own recipient.
function kickoffRecipients(envelope, payload) {
  if (Array.isArray(payload.assignments)) return payload.assignments.map((assignment) => assignment?.to);
  return [envelope.to];
}

// Only a waiting node with every dependency already complete is legal to
// start; anything else (unknown handle, already running/terminal, or still
// blocked on a prerequisite) is silently ignored. Raw envelopes are
// untrusted input from the wider Crew runtime, not ledger-internal calls,
// so wiring code must never let one malformed or repeated envelope throw.
function tryStart(ledger, rawHandle) {
  if (!rawHandle || !ledger.has(rawHandle)) return;
  if (ledger.status(rawHandle) !== "waiting" && ledger.status(rawHandle) !== "ready") return;
  try {
    ledger.start(rawHandle);
  } catch {
    // Dependencies not yet satisfied, or a race with another observer call.
  }
}

// A report-kind payload's `taskStatus` field is the minimal Comm-native
// signal that a task's ledger node has left `running`: `complete` releases
// dependents, `failed`/`blocked` propagate blocked to them. It is keyed by
// the envelope's own sender (`from`), never by an in-payload handle, so a
// report can only ever move the ledger node for the actor that sent it.
// Distinct from the unrelated lifecycle `status` field (`PASS`/`BLOCKED`/
// `FAIL`) some reports already carry; unrecognized or missing values are
// silently ignored, matching kickoff's untrusted-input handling below.
const TASK_STATUS_HANDLERS = Object.freeze({
  complete: (ledger, handle) => ledger.complete(handle),
  failed: (ledger, handle) => ledger.fail(handle),
  blocked: (ledger, handle) => ledger.block(handle),
});

// Reports from the worker contract use PASS/BLOCKED/FAIL, while the
// dependency ledger uses complete/blocked/failed. Both are structured fields;
// neither requires parsing report prose.
const REPORT_STATUS_TO_TASK_STATUS = Object.freeze({ PASS: "complete", BLOCKED: "blocked", FAIL: "failed" });

function tryApplyTaskStatus(ledger, rawHandle, taskStatus) {
  const apply = TASK_STATUS_HANDLERS[taskStatus];
  if (!apply || !rawHandle || !ledger.has(rawHandle)) return;
  try {
    apply(ledger, rawHandle);
  } catch {
    // Not running yet, already terminal, or a race with another observer call.
  }
}

// A real worker's Comm actorId is always namespace-qualified
// ("crew-<runId>-<handle>", e.g. "crew-521574dc-...-developer-snowball-00"
// -- see runtime.mjs's spawn() and worker-comm-extension.mjs's qualify()),
// but the ledger is seeded with the bare handle from
// selected_crew_<uuid>.json ("developer-snowball-00"). Without stripping
// the namespace first, ledger.has()/status() never match a real envelope's
// to/from field -- this was a real, confirmed bug: no ledger node ever left
// "waiting" in any live dispatch, only in tests that emit bare handles
// directly. canonicalHandle() (dependency-ledger.mjs) does not strip this;
// it only validates shape, so stripping must happen here, before the
// ledger ever sees the raw value.
function stripNamespace(rawHandle, namespace) {
  if (!rawHandle || !namespace) return rawHandle;
  const prefix = `${namespace}-`;
  return rawHandle.startsWith(prefix) ? rawHandle.slice(prefix.length) : rawHandle;
}

function handleEnvelope(ledger, envelope, namespace) {
  const payload = envelope?.payload;
  if (!payload || typeof payload !== "object") return;
  if (payload.kind === "kickoff") {
    for (const recipient of kickoffRecipients(envelope, payload))
      tryStart(ledger, stripNamespace(recipient, namespace));
  } else if (payload.kind === "report") {
    const taskStatus = payload.taskStatus ?? REPORT_STATUS_TO_TASK_STATUS[payload.status];
    tryApplyTaskStatus(ledger, stripNamespace(envelope.from, namespace), taskStatus);
  }
}

// attachRawEnvelopeObserver subscribes to CommController.observeRaw() and
// keeps the ledger's running/waiting state in sync with kickoff activity.
// `namespace` is the Crew run's actor-id prefix ("crew-<runId>"), stripped
// from every envelope's to/from before matching against the ledger's
// bare-handle nodes; omit it only for tests that already use bare handles
// end to end. Returns the unsubscribe function observeRaw hands back.
export function attachRawEnvelopeObserver(ledger, comm, namespace) {
  return comm.observeRaw((envelope) => handleEnvelope(ledger, envelope, namespace));
}
