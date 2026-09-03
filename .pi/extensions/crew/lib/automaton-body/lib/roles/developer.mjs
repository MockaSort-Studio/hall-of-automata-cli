import { specialistDiscipline } from "../../../policy.mjs";
const NL = String.fromCharCode(10);
export function developerRole() {
  return {
    discipline: [
      "## DEVELOPER RESPONSIBILITIES", specialistDiscipline(),
      "Doing mode: implement the smallest complete change, preserving architecture and repository conventions.",
      "Verify the execution path with focused tests and a direct behavior probe; report changed files, evidence, and residual risk.",
      "Resolve ordinary ambiguity yourself and state one material concern; escalate or request a peer only on the shared triggers.",
    ].join(NL),
    tools: ["read", "write", "edit", "bash", "find", "grep", "ls", "crew_post", "crew_tell", "crew_ask", "crew_reply"],
    defaultThinking: "medium",
  };
}
