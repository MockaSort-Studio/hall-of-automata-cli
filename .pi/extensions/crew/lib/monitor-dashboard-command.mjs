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

// Sized as a comfortable side panel -- roughly a third of the terminal
// width, never so narrow the table columns collapse into ellipses, and
// capped in height so a long roster doesn't push the tab bar off-screen.
const DASHBOARD_OVERLAY_OPTIONS = Object.freeze({
  width: "33%",
  minWidth: 70,
  maxHeight: "80%",
  anchor: "center",
  margin: 1,
});

// wrapChrome is optional and injected (never imported here) so this file
// stays free of pi-tui imports and importable by plain `node --test`: see
// monitor-dashboard-chrome.mjs for why. monitor.ts is the only real caller
// and always passes wrapDashboardChrome; omitting it (as tests do) falls
// back to the unframed content component instead of throwing.
export const openDashboard = (sessionCtx, getData, wrapChrome) =>
  sessionCtx.ui.custom(
    (_tui, theme, _keybindings, done) => {
      const content = createCrewDashboardComponent({ getData, onClose: () => done(undefined) });
      return wrapChrome ? wrapChrome(theme, content) : content;
    },
    { overlay: true, overlayOptions: DASHBOARD_OVERLAY_OPTIONS },
  );

export function registerCrewDashboardCommand(pi, getData, wrapChrome) {
  pi.registerCommand("crew-dashboard", {
    description: "Open the Crew dashboard (Automata / Plan tabs)",
    handler: async (_args, sessionCtx) => {
      await openDashboard(sessionCtx, getData, wrapChrome);
    },
  });
  pi.registerShortcut("ctrl+shift+d", {
    description: "Open the Crew dashboard",
    handler: async (sessionCtx) => {
      await openDashboard(sessionCtx, getData, wrapChrome);
    },
  });
}
