import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Box, getCapabilities, hyperlink, Text } from "@earendil-works/pi-tui";
import { existsSync, readFileSync, readdirSync, statSync, watch, type FSWatcher } from "node:fs";
import { join, resolve } from "node:path";
import { summarizeWorkerEvents } from "../../runtime/lib/worker-metrics.mjs";
import { crewMonitorView } from "./monitor-state.mjs";
import { renderCrewStatusFooter } from "./monitor-footer.mjs";
import { crewMonitorSnapshot } from "./monitor-snapshot.mjs";
import { lifecycleByActor } from "./monitor-actor-state.mjs";
import { runtimeFor } from "../../runtime/lib/shared-runtime.mjs";
import { buildAutomataTab } from "./monitor-dashboard.mjs";
import { planRowsFor, registerCrewDashboardCommand, selectedCrewFor } from "./monitor-dashboard-command.mjs";
import { wrapDashboardChrome } from "./monitor-dashboard-chrome.mjs";
import { createLiveLedgerTracker } from "./monitor-live-ledger.mjs";
import { ledgerStatusByActor } from "./dependency-ledger-wiring.mjs";

const WIDGET = "crew-monitor";
const ACTIVE = new Set(["queued", "launching", "starting", "started", "closing"]);

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};
const readEvents = (path) => {
  try {
    return readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
};
// Worker metrics live under each actor's own run directory for as long as
// it exists. A terminal member's directory may already be gone by the time
// this renders; summarizeWorkerEvents([]) degrades to all-zero counts.
const workerMetricsByActor = (cwd, roster) => {
  const metrics = {};
  for (const member of roster.members ?? []) {
    if (!member.actorId) continue;
    const path = join(cwd, CONFIG_DIR_NAME, "runtime", "runs", member.actorId, "events.jsonl");
    metrics[member.actorId] = summarizeWorkerEvents(readEvents(path));
  }
  return metrics;
};

export function registerCrewMonitor(pi: ExtensionAPI) {
  let ctx: ExtensionContext | undefined;
  let activePath: string | undefined;
  let watcher: FSWatcher | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let reconciler: ReturnType<typeof setInterval> | undefined;
  // Lazily created once ctx.cwd is known, and kept for the life of the
  // session: one live ledger tracker per Runtime, so the Plan tab reads a
  // ledger kept current by attachRawEnvelopeObserver instead of
  // planRowsFor reseeding a fresh structural-only one on every open.
  let liveLedgerTracker: ReturnType<typeof createLiveLedgerTracker> | undefined;
  const ensureLiveLedgerTracker = () => {
    if (!liveLedgerTracker && ctx) liveLedgerTracker = createLiveLedgerTracker(runtimeFor(ctx.cwd));
    return liveLedgerTracker;
  };

  // A member's own completion report updates the live dependency ledger
  // immediately (dependency-ledger-wiring.mjs); its roster-recorded status
  // only advances when Main explicitly reconciles it. Bridge the two so the
  // footer and Automata tab can show "complete"/"blocked"/"failed" as soon
  // as the worker itself reports it, not only once Main gets around to
  // acting -- see monitor-snapshot.mjs's bucketFor precedence.
  const liveLedgerFor = (roster) => {
    if (!ctx) return undefined;
    const selected = selectedCrewFor(readJson, ctx.cwd, roster);
    return selected ? ensureLiveLedgerTracker()?.ledgerFor(selected) : undefined;
  };

  const root = () => (ctx ? join(ctx.cwd, CONFIG_DIR_NAME, "runtime", "crew-launch") : undefined);
  const latestActive = () => {
    const dir = root();
    if (!dir || !existsSync(dir)) return undefined;
    return readdirSync(dir)
      .filter((name) => name.endsWith("-roster.json"))
      .map((name) => join(dir, name))
      .filter((path) => ACTIVE.has(readJson(path)?.status))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  };

  const clear = () => ctx?.ui.setWidget(WIDGET, undefined);
  const render = (roster) => {
    const view = crewMonitorView(roster);
    if (!ctx || !view) {
      clear();
      return;
    }
    const snapshot = crewMonitorSnapshot(roster, {
      lifecycleByActor: lifecycleByActor(roster),
      workerMetricsByActor: workerMetricsByActor(ctx.cwd, roster),
      ledgerStatusByActor: ledgerStatusByActor(liveLedgerFor(roster), roster.members),
    });
    const footer = renderCrewStatusFooter(snapshot);
    ctx.ui.setWidget(
      WIDGET,
      (_tui, theme) => {
        const box = new Box(1, 0, (text) => theme.bg("customMessageBg", text));
        const icon = view.phase === "Queued" ? "◌" : "◉";
        let text = theme.fg("accent", theme.bold(`${icon} ${footer || `Crew ${view.runId.slice(0, 8)}`}`));
        if (view.discussionNumber && view.discussionUrl) {
          const label = `#${view.discussionNumber} ↗`;
          const link = getCapabilities().hyperlinks
            ? hyperlink(label, view.discussionUrl)
            : `${label} ${view.discussionUrl}`;
          text += ` · ${theme.fg("accent", link)}`;
        }
        box.addChild(new Text(text, 0, 0));
        return box;
      },
      { placement: "aboveEditor" },
    );
  };

  const refresh = () => {
    if (!ctx || ctx.mode !== "tui") return;
    let roster = activePath ? readJson(activePath) : null;
    if (!roster || !ACTIVE.has(roster.status)) {
      activePath = latestActive();
      roster = activePath ? readJson(activePath) : null;
    }
    if (!roster || !ACTIVE.has(roster.status)) {
      activePath = undefined;
      clear();
      return;
    }
    render(roster);
  };

  const schedule = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(refresh, 60);
  };
  const reconcile = () => {
    if (!reconciler) reconciler = setInterval(refresh, 500);
  };

  const ensureWatcher = () => {
    const dir = root();
    if (watcher || !dir || !existsSync(dir)) return;
    watcher = watch(dir, (_event, filename) => {
      if (!filename || filename.endsWith("-roster.json")) schedule();
    });
  };

  const stop = () => {
    if (debounce) clearTimeout(debounce);
    debounce = undefined;
    if (reconciler) clearInterval(reconciler);
    reconciler = undefined;
    watcher?.close();
    watcher = undefined;
    activePath = undefined;
    liveLedgerTracker?.stop();
    liveLedgerTracker = undefined;
    clear();
    ctx = undefined;
  };

  pi.on("session_start", (_event, sessionCtx) => {
    ctx = sessionCtx;
    if (ctx.mode !== "tui") return;
    ensureWatcher();
    reconcile();
    refresh();
  });
  pi.on("session_shutdown", stop);

  // Command-activated dashboard: opens over the current active roster (the
  // same one the footer already tracks) with two tabs, each pulling rows
  // from crewMonitorSnapshot / monitor-dashboard.mjs, never from prose.
  registerCrewDashboardCommand(
    pi,
    () => {
      const path = activePath ?? latestActive();
      const roster = path ? readJson(path) : null;
      if (!ctx || !roster) return { automataRows: [], planRows: [] };
      const ledger = liveLedgerFor(roster);
      const snapshot = crewMonitorSnapshot(roster, {
        lifecycleByActor: lifecycleByActor(roster),
        workerMetricsByActor: workerMetricsByActor(ctx.cwd, roster),
        ledgerStatusByActor: ledgerStatusByActor(ledger, roster.members),
      });
      return { automataRows: buildAutomataTab(snapshot), planRows: planRowsFor(readJson, ctx.cwd, roster, ledger) };
    },
    wrapDashboardChrome,
  );

  return {
    activate(sessionCtx: ExtensionContext, rosterPath: string) {
      ctx = sessionCtx;
      if (ctx.mode !== "tui") return;
      activePath = resolve(ctx.cwd, rosterPath);
      ensureWatcher();
      reconcile();
      refresh();
    },
  };
}
