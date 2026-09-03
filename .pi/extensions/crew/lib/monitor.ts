import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Box, getCapabilities, hyperlink, Text } from "@earendil-works/pi-tui";
import { existsSync, readFileSync, readdirSync, statSync, watch, type FSWatcher } from "node:fs";
import { join, resolve } from "node:path";
import { crewMonitorView } from "./monitor-state.mjs";

const WIDGET = "crew-monitor";
const ACTIVE = new Set(["queued", "launching", "starting", "started", "closing"]);

const readJson = path => {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
};

export function registerCrewMonitor(pi: ExtensionAPI) {
  let ctx: ExtensionContext | undefined;
  let activePath: string | undefined;
  let watcher: FSWatcher | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let reconciler: ReturnType<typeof setInterval> | undefined;

  const root = () => ctx ? join(ctx.cwd, CONFIG_DIR_NAME, "fabric", "crew-launch") : undefined;
  const latestActive = () => {
    const dir = root();
    if (!dir || !existsSync(dir)) return undefined;
    return readdirSync(dir)
      .filter(name => name.endsWith("-roster.json"))
      .map(name => join(dir, name))
      .filter(path => ACTIVE.has(readJson(path)?.status))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  };

  const clear = () => ctx?.ui.setWidget(WIDGET, undefined);
  const render = roster => {
    const view = crewMonitorView(roster);
    if (!ctx || !view) { clear(); return; }
    ctx.ui.setWidget(WIDGET, (_tui, theme) => {
      const box = new Box(1, 0, text => theme.bg("customMessageBg", text));
      const icon = view.phase === "Queued" ? "◌" : "◉";
      let text = theme.fg("accent", theme.bold(`${icon} Crew ${view.runId.slice(0, 8)}`));
      text += theme.fg("muted", `  ${view.phase}`);
      if (view.memberCount > 0) text += theme.fg("dim", ` · ${view.memberCount} specialist`);
      if (view.discussionNumber && view.discussionUrl) {
        const label = `#${view.discussionNumber} ↗`;
        const link = getCapabilities().hyperlinks ? hyperlink(label, view.discussionUrl) : `${label} ${view.discussionUrl}`;
        text += ` · ${theme.fg("accent", link)}`;
      }
      box.addChild(new Text(text, 0, 0));
      return box;
    }, { placement: "aboveEditor" });
  };

  const refresh = () => {
    if (!ctx || ctx.mode !== "tui") return;
    let roster = activePath ? readJson(activePath) : null;
    if (!roster || !ACTIVE.has(roster.status)) {
      activePath = latestActive();
      roster = activePath ? readJson(activePath) : null;
    }
    if (!roster || !ACTIVE.has(roster.status)) { activePath = undefined; clear(); return; }
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
