// Wires Runtime/Lifecycle worker terminal status into the durable Crew
// lifecycle-state contract (lifecycle-state.mjs) and applies the resulting
// state to a roster member record. Pure mapping/transition logic lives here
// so it is unit-testable without a real Lifecycle/worker process; I/O
// helpers below are the thin, testable seam that touches roster files.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isTerminal, transition } from "./lifecycle-state.mjs";

// LifecycleController.terminalStatus (runtime/lib/lifecycle-controller.mjs)
// only ever reports one of these three worker outcomes. "removed" covers an
// intentional stop, which is durably recorded as a stall nobody resolved
// (BLOCKED) rather than a pass or a failure, matching lifecycle-state.mjs's
// own definition of BLOCKED.
const WORKER_OUTCOMES = Object.freeze({ completed: "PASS", failed: "FAIL", removed: "BLOCKED" });

export function outcomeForWorkerStatus(workerStatus) {
  return WORKER_OUTCOMES[workerStatus] ?? null;
}

// Advances one member's durable lifecycle state to the terminal outcome
// implied by a worker's terminal runtime status. Routes BLOCKED through
// "attention" first: running -> BLOCKED is not itself a legal edge in the
// contract, so an intentional stop must pass through the same "stalled,
// unattended" waypoint any other blocked run would.
export function advanceMemberLifecycle(state, workerStatus) {
  const outcome = outcomeForWorkerStatus(workerStatus);
  if (!outcome) return state;
  if (isTerminal(state)) return state;
  let next = state;
  if (outcome === "BLOCKED" && next !== "attention") next = transition(next, "attention");
  return transition(next, outcome);
}

// Pure: returns a new roster object with one member's status advanced, or
// the same roster reference if the actor isn't a member or is already
// terminal. Members default to "running" the first time they receive a
// worker status: prepareCrew/launchPreparedCrew record only "queued"
// launch-time roster status, not a per-member lifecycle state.
export function applyWorkerStatusToRoster(roster, actorId, workerStatus) {
  const members = roster?.members || [];
  const index = members.findIndex((member) => member.actorId === actorId);
  if (index === -1) return roster;
  const current = members[index].status ?? "running";
  const next = advanceMemberLifecycle(current, workerStatus);
  if (next === current) return roster;
  const updated = [...members];
  updated[index] = { ...updated[index], status: next };
  return { ...roster, members: updated };
}

// I/O: applies one worker's terminal status to every roster file in
// crewLaunchDir that lists it as a member, mirroring
// terminalizeRostersForRemovedActors's scan pattern in roster-terminal.mjs.
export function applyWorkerStatusToRosterFiles(crewLaunchDir, actorId, workerStatus) {
  let names;
  try {
    names = readdirSync(crewLaunchDir).filter((name) => name.endsWith("-roster.json"));
  } catch {
    return [];
  }
  const updated = [];
  for (const name of names) {
    const path = join(crewLaunchDir, name);
    const roster = JSON.parse(readFileSync(path, "utf8"));
    const next = applyWorkerStatusToRoster(roster, actorId, workerStatus);
    if (next === roster) continue;
    writeFileSync(path, JSON.stringify(next, null, 2));
    updated.push({ runId: roster.runId, actorId, status: next.members.find((m) => m.actorId === actorId).status });
  }
  return updated;
}
