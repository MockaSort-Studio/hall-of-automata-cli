const number = (value) => (Number.isFinite(value) ? value : 0);

// Percent of the model's context window consumed by one turn's provider
// request. Uses input + cacheRead + cacheWrite because that trio is what the
// provider actually saw as context for that call (uncached tokens plus
// everything served from cache); output tokens are the response, not context.
const contextTokens = (usage) => number(usage?.input) + number(usage?.cacheRead) + number(usage?.cacheWrite);

const round1 = (value) => Math.round(value * 10) / 10;

export function summarizeWorkerEvents(events, { modelWindow } = {}) {
  const turns = events.filter((event) => event.type === "turn");
  const sum = (field) => turns.reduce((total, event) => total + number(event.usage?.[field]), 0);
  const cacheReads = turns.map((event) => number(event.usage?.cacheRead));
  const window = Number.isFinite(modelWindow) && modelWindow > 0 ? modelWindow : null;
  const perTurnPercent = turns.map((event) =>
    window === null ? null : round1(Math.min(100, (contextTokens(event.usage) / window) * 100)),
  );
  const knownPercents = perTurnPercent.filter((percent) => percent !== null);
  return {
    turns: turns.length,
    toolCalls: events.filter((event) => event.type === "tool_start").length,
    toolErrors: events.filter((event) => event.type === "tool_end" && event.error).length,
    compactions: events.filter((event) => event.type === "compaction_end").length,
    providerTraffic: {
      uncachedInput: sum("input"),
      generatedOutput: sum("output"),
      cacheRead: sum("cacheRead"),
      cacheWrite: sum("cacheWrite"),
      total: sum("totalTokens"),
      maxCacheReadPerTurn: Math.max(0, ...cacheReads),
    },
    sessionContext: {
      modelWindow: window,
      perTurnPercent,
      lastPercent: perTurnPercent.length ? perTurnPercent[perTurnPercent.length - 1] : null,
      maxPercent: knownPercents.length ? Math.max(...knownPercents) : null,
    },
  };
}
