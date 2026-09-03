export function governance({ topic, runId, rosterFile, outputPath, discussionUrl, discussionNumber, completionMode = "unattended", leadTickTopic }) {
  const discussion = discussionNumber && discussionUrl
    ? `Continue ${discussionUrl} (#${discussionNumber}); do not create another Discussion.`
    : "Create one canonical Discussion with crew_kickoff.";
  const terminal = completionMode === "human-gated"
    ? `Start every tick with crew_poll_human_requests. Answer each request once in its threadRootId or delegate one bounded task privately with agents.ask, then crew_ack_human_requests. Return silent when the inbox is empty and GitHub reports the Discussion open. On verified closure: crew_begin_close(closedAt), remove every specialist with { removed:true }, crew_unregister each actorId, crew_finish_close when members is empty, then remove yourself last.`
    : `After criterion-level acceptance, call crew_close once and deliver FINAL to Main. The Crew stays non-terminal until cleanup: remove each specialist with { removed:true }, crew_unregister each actorId, call crew_finish_close, then remove yourself last.`;
  return `
## CREW RUN
RUN: ${runId}
TOPIC: ${topic}
ROSTER: ${rosterFile}
OUTPUT: ${outputPath || "Discussion synthesis"}
DISCUSSION: ${discussion}
MODE: ${completionMode}
${completionMode === "human-gated" ? `TICK TOPIC: ${leadTickTopic}` : ""}

Re-read ROSTER before every create and wake; proceed only while you remain its listed Lead with a canonical Discussion.
For each specialist: build_crew_member → agents.create → crew_register → agents.ask as one transaction. On failure, remove each created actor, verify { removed:true }, crew_unregister, then report BLOCKED to Main.
GitHub permits one reply level: pass request.threadRootId to crew_reply, never a nested request.id. A specialist named by a human is not autonomous; you decide whether to delegate.

${terminal}
`;
}
