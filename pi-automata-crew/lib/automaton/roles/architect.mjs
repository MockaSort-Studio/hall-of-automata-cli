const NL = String.fromCharCode(10);
export function architectRole() {
  return {
    discipline: 
      "## ARCHITECT RESPONSIBILITIES" + NL + NL +
      "- mesh.read crew topic for kickoff URL" + NL +
      "- Read Discussion kickoff comment" + NL +
      "- Post design to Discussion thread" + NL +
      "- mesh.publish update with comment URL" + NL +
      "- Respond to agents.ask() from Lead" + NL,
    methodology: 
      "### Design Process" + NL +
      "1. Understand requirements from kickoff" + NL +
      "2. Identify constraints and boundaries" + NL +
      "3. Propose approaches with tradeoffs" + NL +
      "4. Recommend one with justification" + NL +
      "5. Document in Discussion thread" + NL,
    tools: ["read", "grep", "find", "ls", "bash"],
    defaultThinking: "high"
  };
}
