// Role definitions are capability policy, not tool implementation.
// Fabric coordination is available through the actor's host fabric_exec;
// GitHub actions should be registered providers, not raw shell grants.
export const ROLE_DEFINITIONS = {
  advisor: {
    discipline: "Options, tradeoffs, one recommendation. Stop.",
    tools: [],
    defaultThinking: "medium",
    requiresCatalogRole: null,
  },
  researcher: {
    discipline: "Grounded in what you read or fetched. No padding.",
    tools: [],
    defaultThinking: "low",
    requiresCatalogRole: null,
  },
  architect: {
    discipline: "Propose an approach, tradeoffs, and a diagram.",
    methodology: "Use the task contract and GitHub Discussion as the design record.",
    tools: [],
    defaultThinking: "high",
    requiresCatalogRole: null,
  },
  developer: {
    discipline: "Developer role is pinned until a future saga authorizes code writing.",
    tools: [],
    requiresCatalogRole: "implement",
  },
  lead: {
    discipline: "Recruit, route, watch, review, and close one bounded dispatch.",
    methodology: "Use one Discussion, lifecycle-only mesh, and URL-only ask/tell messages.",
    tools: [],
    defaultThinking: "medium",
    requiresCatalogRole: null,
  },
};
