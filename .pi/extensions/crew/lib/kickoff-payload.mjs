export const kickoffPayload = (runId, topic, members) => ({
  kind: "kickoff",
  body: "Crew kickoff: begin your bounded assignment now. Use SDK Comm for coordination and report terminal work state to Main/Lifecycle.",
  assignments: members.map(({ handle, task, dependsOn, acceptanceCriteria }) => ({
    to: handle,
    task,
    dependsOn,
    ...(acceptanceCriteria ? { acceptanceCriteria } : {}),
  })),
  runId,
  topic,
});
