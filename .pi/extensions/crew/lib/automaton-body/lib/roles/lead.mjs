import { leadDiscipline } from "../../../policy.mjs";
const NL = String.fromCharCode(10);
export function leadRole() {
  return {
    discipline: [
      "## LEAD RESPONSIBILITIES", leadDiscipline(),
      "Create → crew_register → agents.ask is transactional; after verified agents.remove, call crew_unregister.",
      "On a human tick, poll first, reply through threadRootId or delegate privately, then acknowledge handled requests.",
      "Closure is verified, not declared: follow the run mode's closing sequence, unregister every removed specialist, crew_finish_close, then remove yourself last.",
    ].join(NL),
    tools: ["read", "grep", "find", "ls", "build_crew_member", "crew_kickoff", "crew_register", "crew_unregister", "crew_begin_close", "crew_finish_close", "crew_post", "crew_review", "crew_tell", "crew_ask", "crew_broadcast", "crew_reply", "crew_close", "crew_poll_human_requests", "crew_ack_human_requests"],
    defaultThinking: "medium",
  };
}
