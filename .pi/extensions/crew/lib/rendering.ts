import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";

const shortId = value => typeof value === "string" ? value.slice(0, 8) : "unknown";

export function registerCrewMessageRenderer(pi: ExtensionAPI) {
  pi.registerMessageRenderer("pi-fabric-agent-message", (message, options, theme) => {
    const details = message.details as { data?: Record<string, unknown> } | undefined;
    const data = details?.data;
    if (data?.kind !== "crew_result") {
      return new Text(message.content, options.outputPad, 0);
    }

    const passed = data.outcome === "PASS";
    const box = new Box(1, 0, text => theme.bg("customMessageBg", text));
    let text = theme.fg(passed ? "success" : "warning", theme.bold(passed ? "✓ Crew complete" : "! Crew finished"));
    text += theme.fg("muted", `  ${String(data.outcome ?? data.status ?? "unknown")}`);
    text += `\n${theme.fg("dim", "Run")}  ${theme.fg("accent", shortId(data.runId))}`;
    if (data.discussionUrl) text += `\n${theme.fg("dim", "Discussion")}  ${String(data.discussionUrl)}`;
    if (data.summary) text += `\n${theme.fg("muted", String(data.summary))}`;
    if (options.expanded && data.finalCommentUrl) {
      text += `\n${theme.fg("dim", "Final record")}  ${String(data.finalCommentUrl)}`;
    }
    if (options.expanded && data.outputPath) {
      text += `\n${theme.fg("dim", "Output")}  ${String(data.outputPath)}`;
    }
    box.addChild(new Text(text, 0, 0));
    return box;
  });
}
