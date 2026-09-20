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

const number = (value) => (Number.isFinite(value) ? value : 0);

// "percent / model window" is the dashboard's compact session-context cell:
// worker-metrics.mjs already computes both halves per actor (sessionContext
// .lastPercent and .modelWindow); this just renders the pair, or an em-dash
// placeholder when either half is not yet known (no turns, or no configured
// window for that model).
export function formatSessionContext(sessionContext) {
  const percent = sessionContext?.lastPercent;
  const window = sessionContext?.modelWindow;
  const percentLabel = Number.isFinite(percent) ? `${percent}%` : "—";
  const windowLabel = Number.isFinite(window) ? String(window) : "—";
  return `${percentLabel} / ${windowLabel}`;
}

// One dashboard row's worth of per-automaton detail, folding a roster
// member's identity + durable lifecycle bucket together with whatever
// worker-metrics.mjs summary is on disk for it right now. Pure: no I/O,
// no default-to-"queued" reinterpretation of bucketFor's own logic.
function automatonDetail(member, actorId, bucket, workerMetricsByActor) {
  const metric = workerMetricsByActor?.[actorId] ?? {};
  const traffic = metric.providerTraffic ?? {};
  return {
    actorId,
    name: member?.name ?? actorId,
    bucket,
    turns: number(metric.turns),
    toolCalls: number(metric.toolCalls),
    toolErrors: number(metric.toolErrors),
    compactions: number(metric.compactions),
    providerTraffic: {
      uncachedInput: number(traffic.uncachedInput),
      generatedOutput: number(traffic.generatedOutput),
      cacheRead: number(traffic.cacheRead),
      cacheWrite: number(traffic.cacheWrite),
    },
    sessionContext: formatSessionContext(metric.sessionContext),
  };
}

export function crewMonitorSnapshot(roster, { lifecycleByActor = {}, workerMetricsByActor = {} } = {}) {
  if (!roster) return null;
  const members = Array.isArray(roster.members) ? roster.members : [];

  const counts = { queued: 0, running: 0, attention: 0, complete: 0, blocked: 0, failed: 0, total: 0 };
  let totalGeneratedOutputTokens = 0;
  const automata = [];

  for (const member of members) {
    const actorId = member?.actorId;
    const bucket = bucketFor(actorId, lifecycleByActor, workerMetricsByActor);
    counts[bucket] += 1;
    counts.total += 1;
    totalGeneratedOutputTokens += generatedOutputFor(actorId, workerMetricsByActor);
    automata.push(automatonDetail(member, actorId, bucket, workerMetricsByActor));
  }

  return {
    runId: String(roster.runId ?? "unknown"),
    counts,
    totalGeneratedOutputTokens,
    automata,
  };
}

export function isTerminalBucket(bucket) {
  return bucket === "complete" || bucket === "blocked" || bucket === "failed";
}

// Re-exported so callers building lifecycleByActor can validate raw values
// against the same durable vocabulary this projection enforces.
export { isTerminal };
