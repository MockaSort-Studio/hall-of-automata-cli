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
      ? "At every tick: if closing, finish verified specialist cleanup and remove yourself last. If started, poll and acknowledge human requests; remain silent when the inbox is empty. On GitHub-confirmed closure, begin closing."
      : "After criterion-level acceptance, close once, unregister verified removals, finish closing, then remove yourself last.";
  return `\n## CREW CONTEXT\nRUN: ${runId}\nTOPIC: ${topic}\nMEMBERS: ${members.map((member) => member.name).join(", ")}\nDISCUSSION: ${discussion}\nMODE: ${completionMode}${completionMode === "human-gated" ? `\nTICK TOPIC: ${leadTickTopic}` : ""}\n\n${terminal}\n`;
}
