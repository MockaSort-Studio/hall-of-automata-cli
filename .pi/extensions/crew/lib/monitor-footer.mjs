import { formatTokenCount } from "./monitor-snapshot.mjs";

// Pure compact status-footer renderer over a CrewMonitorSnapshot.
// One line, no cost/money figures, no queue/inflight abbreviations: just
// automaton counts by durable lifecycle bucket and total generated output.
const BUCKET_LABELS = Object.freeze([
  ["running", "running"],
  ["queued", "queued"],
  ["attention", "needs attention"],
  ["complete", "complete"],
  ["blocked", "blocked"],
  ["failed", "failed"],
]);

export function renderCrewStatusFooter(snapshot) {
  if (!snapshot) return "";
  const { runId, counts, totalGeneratedOutputTokens } = snapshot;
  const total = counts?.total ?? 0;

  const parts = [`Crew ${runId} · ${total} automata`];
  for (const [key, label] of BUCKET_LABELS) {
    const count = counts?.[key] ?? 0;
    if (count > 0) parts.push(`${count} ${label}`);
  }
  const tokens = Number.isFinite(totalGeneratedOutputTokens) ? totalGeneratedOutputTokens : 0;
  parts.push(`${tokens} output tokens`);
  const context = snapshot.contextSummary;
  const percent = Number.isFinite(context?.maxPercent) ? `${context.maxPercent}%` : "—";
  const windows = context?.modelWindows ?? [];
  const window = windows.length === 1 ? formatTokenCount(windows[0]) : windows.length > 1 ? "mixed" : "—";
  parts.push(`context ${percent} / ${window}`);

  return parts.join(" · ");
}
