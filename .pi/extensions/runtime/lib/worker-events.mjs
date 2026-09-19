// Pure mapping from a `pi --mode rpc` event to one bounded, mostly
// content-free log record (or null to skip). Kept separate from worker.mjs
// so the mapping is unit-testable without spawning a real Pi process.

const MAX_ERROR_CHARS = 4000;

export const boundedText = (value, max) => {
  const text = String(value);
  return text.length <= max
    ? text
    : `${text.slice(0, max / 2)}\n…[truncated ${text.length - max} bytes]…\n${text.slice(-max / 2)}`;
};

// Size in bytes without retaining the content itself: safe for tool results
// that may contain file bodies, secrets, or otherwise unbounded text.
const byteSize = (value) => {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "");
  } catch {
    return null;
  }
};

export function mapWorkerEvent(event) {
  switch (event.type) {
    case "agent_start":
      return { type: "agent_start" };
    case "turn_end": {
      const output = (event.message?.content ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      return {
        type: "turn",
        usage: event.message?.usage,
        outputChars: output.length,
        toolCalls: (event.message?.content ?? []).filter((part) => part.type === "toolCall").length,
      };
    }
    case "tool_execution_start":
      return { type: "tool_start", id: event.toolCallId, name: event.toolName };
    case "tool_execution_end":
      return {
        type: "tool_end",
        id: event.toolCallId,
        name: event.toolName,
        error: event.isError,
        resultBytes: byteSize(event.result),
      };
    case "compaction_start":
      return { type: "compaction_start", reason: event.reason };
    case "compaction_end":
      return { type: "compaction_end", reason: event.reason };
    case "extension_error":
      return { type: "agent_error", message: boundedText(event.error, MAX_ERROR_CHARS) };
    default:
      return null;
  }
}
