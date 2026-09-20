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

function handleEnvelope(ledger, envelope) {
  const payload = envelope?.payload;
  if (!payload || typeof payload !== "object" || payload.kind !== "kickoff") return;
  for (const recipient of kickoffRecipients(envelope, payload)) tryStart(ledger, recipient);
}

// attachRawEnvelopeObserver subscribes to CommController.observeRaw() and
// keeps the ledger's running/waiting state in sync with kickoff activity.
// Returns the unsubscribe function observeRaw hands back.
export function attachRawEnvelopeObserver(ledger, comm) {
  return comm.observeRaw((envelope) => handleEnvelope(ledger, envelope));
}
