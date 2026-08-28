// Role-based model: Identity (soul + domain) vs Capacity (role chosen per dispatch)
// Replaces the fixed three-mode enum with an open role registry.

// Open registry — adding a new role means adding one definition, not redesigning the type
export const ROLE_DEFINITIONS = {
  advisor: {
    discipline: "Options, tradeoffs, one recommendation. Stop.",
    tools: ["read", "grep", "find", "ls", "bash"],  // bash wraps github.comment for now
    defaultThinking: "medium",
    requiresCatalogRole: null,  // open to all
  },
  researcher: {
    discipline: "Grounded in what you read/fetched. No padding.",
    tools: ["read", "grep", "find", "ls", "bash"],  // web.fetch + github.comment via bash
    defaultThinking: "low",
    requiresCatalogRole: null,
  },
  architect: {
    discipline: "Propose approach + tradeoffs + diagram.",
    methodology: "(hall-saga Phase 3 design methodology — to be ported)",
    tools: ["read", "grep", "find", "ls", "bash"],
    defaultThinking: "high",
    requiresCatalogRole: null,  // for now; may gate on "design" catalog role later
  },
  developer: {
    // Pinned, absent — same structural pin as before
    discipline: "(developer role pinned — not yet dispatchable)",
    tools: [],
    requiresCatalogRole: "implement",
  },
  lead: {
    discipline: "Recruit, watch, review, close.",
    methodology: "The 4 responsibilities (see saga Appendix) — named for KR 7.3, not yet wired",
    tools: ["read", "grep", "find", "ls", "bash"],  // mesh.* + agents.tell/ask via future extension
    defaultThinking: "medium",
    requiresCatalogRole: null,  // for now; may gate later
  },
};
