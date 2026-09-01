import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crewMonitorView, isTerminalCrew } from "../../.pi/extensions/crew/lib/monitor-state.mjs";

const source = readFileSync(new URL("../../.pi/extensions/crew/lib/monitor.ts", import.meta.url), "utf8");

const roster = overrides => ({
  runId: "run-123456", status: "started", discussionNumber: 42,
  discussionUrl: "https://github.com/org/repo/discussions/42", members: [],
  ...overrides,
});

test("single-Crew view derives useful runtime phases", () => {
  assert.equal(crewMonitorView(roster({ status: "queued" })).phase, "Queued");
  assert.equal(crewMonitorView(roster({ status: "starting" })).phase, "Starting");
  assert.equal(crewMonitorView(roster({ discussionUrl: null })).phase, "Framing");
  assert.equal(crewMonitorView(roster({})).phase, "Recruiting");
  assert.equal(crewMonitorView(roster({ members: [{ name: "architect-a" }] })).phase, "Working");
  assert.equal(crewMonitorView(roster({ members: [{}], finalCommentUrl: "https://example/final" })).phase, "Closing");
});

test("terminal Crew removes the monitor", () => {
  assert.equal(isTerminalCrew(roster({ status: "closed" })), true);
  assert.equal(isTerminalCrew(roster({ status: "failed" })), true);
  assert.equal(crewMonitorView(roster({ status: "closed" })), null);
});

test("widget is fixed below editor, clickable when supported, and cleaned up", () => {
  assert.match(source, /placement: "aboveEditor"/);
  assert.match(source, /hyperlink\(label, view\.discussionUrl\)/);
  assert.match(source, /getCapabilities\(\)\.hyperlinks/);
  assert.match(source, /watch\(dir/);
  assert.match(source, /session_shutdown/);
  assert.match(source, /watcher\?\.close\(\)/);
  assert.match(source, /setWidget\(WIDGET, undefined\)/);
});
