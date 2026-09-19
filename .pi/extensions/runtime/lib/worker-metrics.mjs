const number = (value) => (Number.isFinite(value) ? value : 0);

export function summarizeWorkerEvents(events) {
  const turns = events.filter((event) => event.type === "turn");
  const sum = (field) => turns.reduce((total, event) => total + number(event.usage?.[field]), 0);
  const cacheReads = turns.map((event) => number(event.usage?.cacheRead));
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
  };
}
