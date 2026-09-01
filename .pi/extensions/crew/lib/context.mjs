const compact = value => String(value ?? "").replace(/\s+/g, " ").trim();

export function minimalCrewResult(data) {
  const runId = compact(data.runId).slice(0, 8) || "unknown";
  const outcome = compact(data.outcome || data.status) || "unknown";
  const summary = compact(data.summary).slice(0, 320);
  const record = compact(data.finalCommentUrl || data.discussionUrl);
  return [
    `[Crew result ${runId}] ${outcome}.`,
    summary,
    record && `Record: ${record}`,
  ].filter(Boolean).join(" ");
}

export function minimizeCrewContext(messages) {
  return messages.map(message => {
    const data = message?.role === "custom" && message.customType === "pi-fabric-agent-message"
      ? message.details?.data
      : undefined;
    if (data?.kind !== "crew_result") return message;
    return { ...message, content: minimalCrewResult(data), details: undefined };
  });
}
