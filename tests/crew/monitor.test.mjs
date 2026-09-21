import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crewMonitorView, isTerminalCrew } from "../../.pi/extensions/crew/lib/monitor-state.mjs";

const source = readFileSync(new URL("../../.pi/extensions/crew/lib/monitor.ts", import.meta.url), "utf8");

const roster = (overrides) => ({
  runId: "run-123456",
  status: "started",
  discussionNumber: 42,
  discussionUrl: "https://github.com/org/repo/discussions/42",
  members: [],
  ...overrides,
});

test("single-Crew view derives useful runtime phases", () => {
  assert.equal(crewMonitorView(roster({ status: "queued" })).phase, "Queued");
  assert.equal(crewMonitorView(roster({ status: "starting" })).phase, "Starting");
  assert.equal(crewMonitorView(roster({ status: "closing" })).phase, "Disbanding");
  assert.equal(
    crewMonitorView(roster({ status: "closing", discussionClosed: true, members: [{}] })).phase,
    "Disbanding",
  );
  assert.equal(crewMonitorView(roster({ discussionUrl: null })).phase, "Framing");
  assert.equal(crewMonitorView(roster({})).phase, "Recruiting");
  assert.equal(crewMonitorView(roster({ members: [{ name: "architect-a" }] })).phase, "Working");
  assert.equal(crewMonitorView(roster({ members: [{}], finalCommentUrl: "https://example/final" })).phase, "Closing");
});

test("terminal Crew removes the monitor", () => {
  assert.equal(isTerminalCrew(roster({ status: "done" })), true);
  assert.equal(isTerminalCrew(roster({ status: "closing", discussionClosed: true })), false);
  assert.equal(isTerminalCrew(roster({ status: "closing", discussionClosed: true, members: [{}] })), false);
  assert.equal(crewMonitorView(roster({ status: "done" })), null);
});

test("widget is fixed above editor, clickable when supported, and cleaned up", () => {
  assert.match(source, /placement: "aboveEditor"/);
  assert.match(source, /hyperlink\(label, view\.discussionUrl\)/);
  assert.match(source, /getCapabilities\(\)\.hyperlinks/);
  assert.match(source, /watch\(dir/);
  assert.match(source, /session_shutdown/);
  assert.match(source, /watcher\?\.close\(\)/);
  assert.match(source, /setWidget\(WIDGET, undefined\)/);
  assert.match(source, /setInterval\(refresh, 500\)/);
  assert.match(source, /clearInterval\(reconciler\)/);
});

test("widget renders the live CrewMonitorSnapshot footer, not a static phase line", () => {
  assert.match(source, /import \{ crewMonitorSnapshot \} from "\.\/monitor-snapshot\.mjs"/);
  assert.match(source, /import \{ lifecycleByActor \} from "\.\/monitor-actor-state\.mjs"/);
  assert.match(source, /import \{ renderCrewStatusFooter \} from "\.\/monitor-footer\.mjs"/);
  assert.match(source, /import \{ summarizeWorkerEvents \} from "\.\.\/\.\.\/runtime\/lib\/worker-metrics\.mjs"/);
  assert.match(source, /crewMonitorSnapshot\(roster, \{/);
  assert.match(source, /renderCrewStatusFooter\(snapshot\)/);
});

test("the Crew dashboard command/shortcut are wired from monitor-dashboard.mjs data, not prose", () => {
  assert.match(source, /import \{ buildAutomataTab \} from "\.\/monitor-dashboard\.mjs"/);
  assert.match(
    source,
    /import \{ planRowsFor, registerCrewDashboardCommand, selectedCrewFor \} from "\.\/monitor-dashboard-command\.mjs"/,
  );
  assert.match(source, /registerCrewDashboardCommand\(\s*pi,\s*\(\) => \{/);
  assert.match(source, /buildAutomataTab\(snapshot\)/);
  assert.match(source, /planRowsFor\(readJson, ctx\.cwd, roster, ledger\)/);
});

test("the Crew dashboard is given real border/background chrome, not unframed text", () => {
  // wrapDashboardChrome needs the real pi-tui/pi-coding-agent packages
  // (DynamicBorder + Box), which aren't resolvable from plain `node --test`
  // in this repo -- see monitor-dashboard-chrome.mjs's header comment. Its
  // wiring here is verified the same way the rest of monitor.ts's pi-tui
  // usage already is: source-pattern assertions, plus a manual TUI smoke
  // test (`cc --plugin-dir . --debug`, then `/crew-dashboard`).
  assert.match(source, /import \{ wrapDashboardChrome \} from "\.\/monitor-dashboard-chrome\.mjs"/);
  assert.match(source, /\},\s*wrapDashboardChrome,?\s*\);/);
});

test("the Plan tab reads a live ledger kept current by attachRawEnvelopeObserver, not a fresh reseed per open", () => {
  assert.match(source, /import \{ createLiveLedgerTracker \} from "\.\/monitor-live-ledger\.mjs"/);
  assert.match(source, /import \{ runtimeFor \} from "\.\.\/\.\.\/runtime\/lib\/shared-runtime\.mjs"/);
  assert.match(source, /createLiveLedgerTracker\(runtimeFor\(ctx\.cwd\)\)/);
  assert.match(source, /ensureLiveLedgerTracker\(\)\?\.ledgerFor\(selected\)/);
  assert.match(source, /liveLedgerTracker\?\.stop\(\)/);
});
