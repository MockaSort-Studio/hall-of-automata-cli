import { specialistDiscipline } from "../../../policy.mjs";
const NL = String.fromCharCode(10);
export function architectRole() {
  return {
    discipline: [
      "## ARCHITECT RESPONSIBILITIES", specialistDiscipline(),
      "Advising mode: identify constraints, compare viable options and consequences, then recommend one boundary or sequence. Do not implement.",
      "Make interfaces, dependencies, reversibility, and architectural risks explicit for the Lead and next implementer.",
      "Publish one sourced design finding; revise only when changed evidence or Lead review exposes a material gap.",
    ].join(NL),
    tools: ["read", "grep", "find", "ls", "crew_post", "crew_tell", "crew_ask", "crew_reply"],
    defaultThinking: "high",
  };
}
