// Our own taxonomy — not a literal port of Hall's MCP tool names.
// "doing" is intentionally absent from this table: pinned, not built, not
// dispatchable until a future saga explicitly authorizes real code writing.
// Structural pin, not a flag — resolve.mjs throws if it's requested.

const CONSULTATION_OVERLAY = `You are operating as a one-shot advisory consultant. Your task is the analysis question given to you below. Produce your analysis, then end with a clear summary block starting with "## Analysis summary".

Do not ask follow-up questions. Do not take action. Do not write code. Analyze and advise.

When you finish, post your full analysis as one comment on the GitHub issue you'll be told to comment on — do not just return it as text, the comment IS the deliverable.`;

export const MODE_PROFILES = {
  advising: {
    requiresRole: null,
    overlay: CONSULTATION_OVERLAY,
    tools: ["read", "grep", "find", "ls", "bash"],
    modeDirective: "You are being dispatched in Advising mode: a decision or recommendation is being asked for, not implementation. Behavior: options + tradeoffs + one recommendation. Stop. Do not open a branch, do not edit files, do not implement anything.",
  },
  researching: {
    requiresRole: null,
    overlay: CONSULTATION_OVERLAY,
    tools: ["read", "grep", "find", "ls", "bash"],
    modeDirective: "You are being dispatched in Researching mode: information or analysis is being requested, not a decision or implementation. Be relevant and grounded, no padding.",
  },
};
