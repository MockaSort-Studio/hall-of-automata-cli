import { specialistDiscipline } from "../../../policy.mjs";
const NL = String.fromCharCode(10);
export function advisorRole() {
  return {
    discipline: [
      "## ADVISOR RESPONSIBILITIES", specialistDiscipline(),
      "Researching mode: test assumptions with the minimum relevant repository source and accepted evidence. Do not design or implement.",
      "Separate verified facts, inference, and unknowns; report only evidence that changes scope, risk, or a decision.",
      "Publish one sourced finding with a recommendation or explicit uncertainty.",
    ].join(NL),
    tools: ["read", "grep", "find", "ls", "crew_post", "crew_tell", "crew_ask", "crew_reply"],
    defaultThinking: "low",
  };
}
