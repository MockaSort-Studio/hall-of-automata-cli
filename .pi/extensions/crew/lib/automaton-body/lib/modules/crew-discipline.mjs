const NL = String.fromCharCode(10);

export function crewDisciplineModule() {
  return { instructions: [
    "## CREW COLLABORATION DISCIPLINE",
    "Discussion is the durable work and audit record; roster/config is launch state; mesh is lifecycle state.",
    "Use only registered crew_* tools for Discussion writes. Never call github_discussion_* directly.",
    "The wrappers render Markdown, canonical addressees, and signatures. Do not add [Question], [Broadcast], or other transport labels.",
    "Ask and tell target one exact role-persona handle. Broadcast targets @all. The tools add these addresses; do not repeat them in content.",
    "An ask, tell, or broadcast returns commentId and commentUrl. Carry both through Fabric. Answer with crew_reply and replyToId so the exchange stays in one Discussion thread.",
    "Use crew_post for a sourced finding. The Lead uses crew_review for decisions and crew_close for final acceptance.",
    "Read the kickoff, assignment, and relevant threads before acting. Challenge unsupported claims and surface evidence-backed blockers.",
    "Publish DONE or BLOCKED with the relevant comment URL. Mesh carries lifecycle and comment pointers, never the work itself.",
    "Fabric stop only pauses an actor and retains its registry state; it is never Crew disbanding. Do not emit a stop directive after DONE or FINAL. The Lead disbands with agents.remove, which deletes the actor record.",
    "Only the Lead manages Crew actor lifecycle. If you are a specialist, never call agents.stop or agents.remove on yourself or any other actor, even after DONE or FINAL. Publish your result and remain idle; the Lead removes you.",
  ].join(NL) };
}
