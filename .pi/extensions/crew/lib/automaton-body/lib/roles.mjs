// Role definitions — capability policy only, not implementation.
// Disciplines live in roles/*.mjs; these are fallback stubs + tool grants.
export const ROLE_DEFINITIONS = {
  lead: {
    discipline: "Orchestrate, synthesise, close. Never implement.",
    tools: [],
    defaultThinking: "medium",
  },
  architect: {
    discipline: "Advising mode: options, tradeoffs, one recommendation. Stop.",
    tools: ["read", "grep", "find", "ls", "bash"],
    defaultThinking: "high",
  },
  developer: {
    discipline: "Doing mode: build it, flag one concern, proceed.",
    tools: ["read", "write", "edit", "bash", "find", "grep", "ls"],
    defaultThinking: "medium",
    requiresCatalogRole: "implement",
  },
  advisor: {
    discipline: "Researching mode: relevant and grounded. No padding. No write.",
    tools: ["read", "grep", "find", "ls", "bash"],
    defaultThinking: "low",
  },
};
