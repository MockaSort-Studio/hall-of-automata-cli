// Pure CrewMonitorSnapshot projection: durable roster + per-actor lifecycle
// state + worker metrics already on disk, folded into one compact view.
// No I/O here; callers load the roster JSON, lifecycle-state values, and
// worker-metrics.mjs summaries and pass them in.
import { STATES, TERMINAL_OUTCOMES, isTerminal } from "./lifecycle-state.mjs";

const BUCKET_FOR_STATE = Object.freeze({
  queued: "queued",
  running: "running",
  attention: "attention",
  PASS: "complete",
  BLOCKED: "blocked",
  FAIL: "failed",
});

const KNOWN_STATES = new Set([...STATES, ...TERMINAL_OUTCOMES]);

// A roster member has no durable "running" write path today: roster-lifecycle.mjs
// only records terminal PASS/BLOCKED/FAIL at worker removal, so an actor that
// has actually started work still reads back as the "queued" default forever.
// When no explicit lifecycle entry is recorded, fall back to live worker-metrics
// evidence (turns or tool calls > 0) to distinguish "running" from "queued".
function hasLiveActivity(actorId, workerMetricsByActor) {
  const metric = workerMetricsByActor?.[actorId];
  const turns = metric?.turns;
  const toolCalls = metric?.toolCalls;
  return (Number.isFinite(turns) && turns > 0) || (Number.isFinite(toolCalls) && toolCalls > 0);
}

function bucketFor(actorId, lifecycleByActor, workerMetricsByActor) {
  const recorded = lifecycleByActor[actorId];
  const state = recorded ?? (hasLiveActivity(actorId, workerMetricsByActor) ? "running" : "queued");
  if (!KNOWN_STATES.has(state)) throw new Error(`Unknown Crew lifecycle state: ${state}`);
  return BUCKET_FOR_STATE[state];
}

function generatedOutputFor(actorId, workerMetricsByActor) {
  const metric = workerMetricsByActor?.[actorId];
  const value = metric?.providerTraffic?.generatedOutput;
  return Number.isFinite(value) ? value : 0;
}

export function crewMonitorSnapshot(roster, { lifecycleByActor = {}, workerMetricsByActor = {} } = {}) {
  if (!roster) return null;
  const members = Array.isArray(roster.members) ? roster.members : [];

  const counts = { queued: 0, running: 0, attention: 0, complete: 0, blocked: 0, failed: 0, total: 0 };
  let totalGeneratedOutputTokens = 0;

  for (const member of members) {
    const actorId = member?.actorId;
    counts[bucketFor(actorId, lifecycleByActor, workerMetricsByActor)] += 1;
    counts.total += 1;
    totalGeneratedOutputTokens += generatedOutputFor(actorId, workerMetricsByActor);
  }

  return {
    runId: String(roster.runId ?? "unknown"),
    counts,
    totalGeneratedOutputTokens,
  };
}

export function isTerminalBucket(bucket) {
  return bucket === "complete" || bucket === "blocked" || bucket === "failed";
}

// Re-exported so callers building lifecycleByActor can validate raw values
// against the same durable vocabulary this projection enforces.
export { isTerminal };
