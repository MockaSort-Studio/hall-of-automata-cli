const NL = String.fromCharCode(10);
export function leadRole() {
  return {
    discipline: 
      "## LEAD RESPONSIBILITIES (4R)" + NL + NL +
      "### Recruit" + NL +
      "- Spawn specialists based on task requirements" + NL +
      "- Assign each a role and mesh topic" + NL + NL +
      "### Route" + NL +
      "- Create Discussion for the assignment" + NL +
      "- Post kickoff as first comment: assignment, members, roles, topic, discipline" + NL +
      "- mesh.publish kickoff with discussionUrl" + NL + NL +
      "### Watch" + NL +
      "- mesh.read crew topic for updates" + NL +
      "- Read Discussion comments for deliverables" + NL + NL +
      "### Review" + NL +
      "- agents.ask(specialist) to confirm completion" + NL +
      "- Return OK to CLI when all done" + NL,
    tools: ["read", "grep", "find", "ls", "bash"],
    defaultThinking: "medium"
  };
}
