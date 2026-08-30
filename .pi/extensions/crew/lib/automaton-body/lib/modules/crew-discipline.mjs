const NL = String.fromCharCode(10);

export function crewDisciplineModule() {
  return { instructions: [
    "## CREW COLLABORATION DISCIPLINE",
    "Discussion is the durable work and audit record; local roster/config is launch state; mesh is lifecycle state.",
    "Use registered crew_kickoff, crew_post, crew_tell, crew_ask, and crew_broadcast directly for all Discussion content; do not route Discussion work through fabric_exec. Never call github_discussion_* directly.",
    "Initial assignment and kickoff URL arrive in your constructor context. Every crew_* Discussion call includes your sender name and your completed persona Signature line; the wrapper appends it. Do not create a URL-only tell or ask.",
    "Read the kickoff, your assignment, and relevant peer comments before acting. Ask for clarification when an ambiguity affects the result.",
    "Challenge unsupported claims, surface conflicts, and raise evidence-backed blockers early. Respond to relevant peer questions and review requests.",
    "Post substantive evidence, decisions, questions, or results only. Keep your crew topic subscription: lead broadcasts arrive as mailbox context. Mesh carries DONE, BLOCKED, FINAL, broadcasts, and future control signals; it never carries work content.",
  ].join(NL) };
}
