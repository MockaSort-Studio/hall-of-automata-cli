const text = (value) => (typeof value === "string" ? value : "");
const content = (value) => (Array.isArray(value) ? value : []);

// Mirrors Pi's conservative transcript estimator: model-facing characters ÷ 4.
function estimateTokens(message) {
  let chars = 0;
  for (const block of content(message?.content)) {
    if (block.type === "toolCall") chars += text(block.name).length + JSON.stringify(block.arguments || {}).length;
    else if (block.type === "thinking") chars += text(block.thinking).length;
    else chars += text(block.text).length;
  }
  return Math.ceil(chars / 4);
}

export function toolKind(name) {
  return name === "fabric_exec" ? "fabric_exec" : "native";
}

export function toolCallTokens(name, input) {
  return estimateTokens({
    role: "assistant",
    content: [{ type: "toolCall", name, arguments: input || {} }],
  });
}

export function toolResultTokens(result) {
  return estimateTokens({ role: "toolResult", content: content(result?.content) });
}

export function assistantTextTokens(message) {
  return estimateTokens({
    role: "assistant",
    content: content(message?.content).filter((block) => block.type === "text" || block.type === "thinking"),
  });
}

export function toolWindowTotals(window) {
  return window.reduce(
    (totals, entry) => {
      const bucket = totals[entry.kind];
      bucket.calls += entry.callTokens;
      bucket.results += entry.resultTokens;
      bucket.count += 1;
      return totals;
    },
    {
      fabric_exec: { calls: 0, results: 0, count: 0 },
      native: { calls: 0, results: 0, count: 0 },
    },
  );
}

export function staticContextTokens(systemPrompt, tools) {
  return {
    systemPrompt: Math.ceil(text(systemPrompt).length / 4),
    toolSchemas: Math.ceil(JSON.stringify(tools || []).length / 4),
  };
}
