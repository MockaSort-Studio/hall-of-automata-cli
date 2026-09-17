export function governance({
  topic,
  runId,
  members,
  discussionUrl,
  discussionNumber,
  completionMode = "unattended",
  leadTickTopic,
}) {
  const discussion =
    discussionNumber && discussionUrl
      ? `Continue ${discussionUrl} (#${discussionNumber}); do not create another Discussion.`
      : "Create one canonical Discussion with crew_kickoff.";
  const terminal =
    completionMode === "human-gated"
      ? "Human-gated mode is not available on the SDK Crew runtime yet."
      : "After criterion-level acceptance, close once, record verified cleanup state when available, and finish. Main/Lifecycle owns SDK worker removal.";
  return `\n## CREW CONTEXT\nRUN: ${runId}\nTOPIC: ${topic}\nMEMBERS: ${members.map((member) => member.name).join(", ")}\nDISCUSSION: ${discussion}\nMODE: ${completionMode}${completionMode === "human-gated" ? `\nTICK TOPIC: ${leadTickTopic}` : ""}\n\n${terminal}\n`;
}
