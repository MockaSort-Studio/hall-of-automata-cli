// Rendering + keyboard wiring for the expandable Crew dashboard. Row data
// comes entirely from monitor-dashboard.mjs (itself sourced from
// monitor-snapshot.mjs and selected_crew_<uuid>.json / the dependency
// ledger); this file only turns those rows into terminal lines and handles
// tab switching. No pi-tui import: `render(width): string[]` is the whole
// Component contract this needs, so the formatting logic stays testable
// without the real TUI package installed.
const TABS = Object.freeze(["automata", "plan"]);

const pad = (value, width) => String(value).slice(0, width).padEnd(width);

function automataHeader() {
  return "NAME            BUCKET     TURNS TOOLS ERRS  IN     OUT    CACHE R/W      CTX               COMPACT";
}

function automataRow(row) {
  const cache = `${row.providerTraffic?.cacheRead ?? 0}/${row.providerTraffic?.cacheWrite ?? 0}`;
  return [
    pad(row.name, 15),
    pad(row.bucket, 10),
    pad(row.turns, 5),
    pad(row.toolCalls, 5),
    pad(row.toolErrors, 5),
    pad(row.providerTraffic?.uncachedInput ?? 0, 6),
    pad(row.providerTraffic?.generatedOutput ?? 0, 6),
    pad(cache, 14),
    pad(row.sessionContext, 17),
    pad(row.compactions, 7),
  ].join(" ");
}

// formatAutomataLines is pure and independently testable: a header line
// plus one formatted line per automaton detail row from monitor-dashboard's
// buildAutomataTab.
export function formatAutomataLines(rows) {
  if (!rows.length) return ["(no automata on the roster yet)"];
  return [automataHeader(), ...rows.map(automataRow)];
}

function planRow(row) {
  const dependsOn = row.dependsOn.length ? row.dependsOn.join(", ") : "-";
  return `${pad(row.assignedAutomaton, 22)} ${pad(row.status, 10)} depends-on: ${dependsOn}  ${row.task}`;
}

// formatPlanLines is pure and independently testable: one line per Crew
// member's static task/dependsOn plan entry plus whatever live status the
// dependency ledger currently reports for it.
export function formatPlanLines(rows) {
  if (!rows.length) return ["(no plan recorded for this Crew yet)"];
  return rows.map(planRow);
}

function linesForTab(tab, data) {
  return tab === "plan" ? formatPlanLines(data.planRows) : formatAutomataLines(data.automataRows);
}

// createCrewDashboardComponent builds a pi-tui Component: `getData()` is
// called fresh on every render so the dashboard reflects the live snapshot,
// not a stale one captured at open time. `tab`/`switchTab` are exposed
// directly so tests can drive tab state without a real render pass.
export function createCrewDashboardComponent({ getData, onClose }) {
  let tab = TABS[0];
  return {
    get tab() {
      return tab;
    },
    switchTab() {
      tab = tab === "automata" ? "plan" : "automata";
    },
    render(width) {
      const data = getData();
      const tabBar = TABS.map((name) => (name === tab ? `[${name}]` : ` ${name} `)).join(" ");
      const lines = [`Crew dashboard \u2014 ${tabBar}  (tab: switch, esc: close)`, ...linesForTab(tab, data)];
      return lines.map((line) => line.slice(0, Math.max(0, width)));
    },
    handleInput(data) {
      if (data === "\t") {
        this.switchTab();
        return;
      }
      if (data === "\x1b" || data === "q") onClose?.();
    },
    invalidate() {},
  };
}
