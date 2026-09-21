// Registers the command + shortcut that open the Crew dashboard overlay.
// Kept separate from monitor.ts so that file stays focused on the footer
// widget's own lifecycle; `getData` is the only seam this needs, supplied
// by the caller which already knows how to resolve the active roster.
import { join } from "node:path";
import { createCrewDashboardComponent } from "./monitor-dashboard-view.mjs";
import { buildPlanTab } from "./monitor-dashboard.mjs";
import { readableDependencyLedgerSnapshot, seedDependencyLedgerFromSelectedCrew } from "./dependency-ledger-wiring.mjs";

// Reads the durable selected_crew_<uuid>.json plan document for a roster,
// resolved from roster.selectedCrew (a path relative to cwd, written by
// prepareCrew). Absent until a Crew's plan is recorded, or once its files
// are cleaned up.
export const selectedCrewFor = (readJson, cwd, roster) =>
  roster.selectedCrew ? readJson(join(cwd, roster.selectedCrew)) : null;

// Plan tab rows: task/dependsOn come from selected_crew_<uuid>.json, live
// status comes from `ledger` when the caller has one (monitor.ts's
// monitor-live-ledger.mjs tracker, kept current by live kickoff/report
// envelopes via attachRawEnvelopeObserver) -- otherwise falls back to a
// fresh ledger seeded from the same plan, which only ever reports
// structural "waiting"/"ready" state. Either way, status is always
// programmatically sourced, never report/prose.
export function planRowsFor(readJson, cwd, roster, ledger) {
  const selected = selectedCrewFor(readJson, cwd, roster);
  if (!selected) return [];
  const activeLedger = ledger ?? seedDependencyLedgerFromSelectedCrew(selected);
  const ledgerSnapshot = readableDependencyLedgerSnapshot(activeLedger, selected.members ?? []);
  return buildPlanTab({ selectedCrew: selected, ledgerSnapshot });
}

const openDashboard = (sessionCtx, getData) =>
  sessionCtx.ui.custom(
    (_tui, _theme, _keybindings, done) => createCrewDashboardComponent({ getData, onClose: () => done(undefined) }),
    { overlay: true },
  );

export function registerCrewDashboardCommand(pi, getData) {
  pi.registerCommand("crew-dashboard", {
    description: "Open the Crew dashboard (Automata / Plan tabs)",
    handler: async (_args, sessionCtx) => {
      await openDashboard(sessionCtx, getData);
    },
  });
  pi.registerShortcut("ctrl+shift+d", {
    description: "Open the Crew dashboard",
    handler: async (sessionCtx) => {
      await openDashboard(sessionCtx, getData);
    },
  });
}
