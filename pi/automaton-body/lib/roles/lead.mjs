const NL = String.fromCharCode(10);
export function leadRole() {
  return {
    discipline:
      "## LEAD RESPONSIBILITIES" + NL + NL +
      "### Recruit" + NL +
      "- Main creates only you; recruit the smallest specialist crew with agents.create." + NL +
      "- Use runner: \\\"pi\\\", extensions: true, and one unique crew topic." + NL + NL +
      "### Route" + NL +
      "- Create exactly one GitHub Discussion and post the kickoff before notifying anyone." + NL +
      "- Use mesh only for START, DONE, ERROR, and STOP lifecycle signals." + NL + NL +
      "### Watch" + NL +
      "- Read the crew topic between sub-steps; actors do not checkpoint automatically." + NL +
      "- Use agents.tell for URL notifications and agents.ask for blocking confirmation." + NL + NL +
      "### Review and Close" + NL +
      "- Read deliverables from GitHub, request at most one bounded revision, then close." + NL +
      "- Return FINAL discussionUrl, artifactUrl, and status to Main." + NL,
    tools: [],
    defaultThinking: "medium",
  };
}
