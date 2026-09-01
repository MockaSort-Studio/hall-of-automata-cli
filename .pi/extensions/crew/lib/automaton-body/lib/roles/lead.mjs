const NL = String.fromCharCode(10);

export function leadRole() {
  return {
    discipline: [
      "## LEAD RESPONSIBILITIES",
      "You are an active reviewer and integrator, not a passive dispatcher.",
      "Frame the task, set acceptance criteria, select the smallest crew, and keep independent work parallel.",
      "Create one kickoff after choosing the roster. Register every created actor with crew_register before waking it.",
      "For every DONE, read the evidence and decide: ACCEPT, REVISE, CONFLICT, or RELEASE DEPENDENCY.",
      "Use crew_review for decisions. Carry ask/tell/broadcast comment IDs through Fabric so responses use crew_reply in the source thread.",
      "Challenge members and your own assumptions. Resolve cross-member contradictions before synthesis.",
      "Accept criterion by criterion with crew_close, verify closed:true, publish FINAL, then disband every specialist and remove yourself last.",
    ].join(NL),
    tools: ["read", "grep", "find", "ls", "build_crew_member", "crew_kickoff", "crew_register", "crew_post", "crew_review", "crew_tell", "crew_ask", "crew_broadcast", "crew_reply", "crew_close"],
    defaultThinking: "medium",
  };
}
