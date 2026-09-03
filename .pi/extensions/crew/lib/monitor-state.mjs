const TERMINAL = new Set(["closed", "failed", "cancelled"]);

export function isTerminalCrew(roster) {
  // A closed Discussion with no remaining specialists is done even if disband bookkeeping crashed.
  return TERMINAL.has(roster?.status) || (roster?.discussionClosed === true && !(roster?.members?.length > 0));
}

export function crewMonitorView(roster) {
  if (!roster || isTerminalCrew(roster)) return null;
  let phase = "Queued";
  if (roster.status === "launching" || roster.status === "starting") phase = "Starting";
  if (roster.status === "closing") phase = "Disbanding";

  if (roster.status === "started") {
    if (!roster.discussionUrl) phase = "Framing";
    else if (!(roster.members?.length > 0)) phase = "Recruiting";
    else if (roster.finalCommentUrl) phase = "Closing";
    else phase = "Working";
  }
  return {
    runId: String(roster.runId ?? "unknown"),
    phase,
    discussionNumber: roster.discussionNumber ?? null,
    discussionUrl: roster.discussionUrl ?? null,
    memberCount: roster.members?.length ?? 0,
  };
}
