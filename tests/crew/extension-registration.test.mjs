import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../.pi/extensions/hall-crew/crew/index.ts", import.meta.url), "utf8");

test("crew extension imports all tool registration functions", () => {
  assert.match(source, /runtimeFor/);
  assert.match(source, /import.*registerCommunicationTools.*from.*communication-tools/);
  assert.match(source, /import.*registerRosterTools.*from.*roster-tools/);
});

test("start_crew schema exposes the bounded microVM environment contract", () => {
  assert.match(source, /environment: Type\.Optional\(\s*Type\.Object\(/);
  for (const value of ["auto", "gondolin", "none"]) assert.match(source, new RegExp(`Type\\.Literal\\("${value}"\\)`));
});

test("crew extension wires terminal notifications through Main session flow", () => {
  assert.match(source, /attachTerminalNotifier/);
  assert.match(source, /attachTerminalNotifier\(ctx\)/);
});

test("crew extension calls all tool registration functions", () => {
  assert.match(source, /registerCommunicationTools\(pi\)/);
  assert.match(source, /registerRosterTools\(pi\)/);
});

test("communication tools module exports registration function", () => {
  const commTools = readFileSync(
    new URL("../../.pi/extensions/hall-crew/crew/lib/communication-tools.ts", import.meta.url),
    "utf8",
  );
  assert.match(commTools, /export function registerCommunicationTools/);
  assert.match(commTools, /name: "crew_kickoff"/);
  assert.match(commTools, /name: "crew_close"/);
});

test("roster tools module exports registration function", () => {
  const rosterTools = readFileSync(new URL("../../.pi/extensions/hall-crew/crew/lib/roster-tools.ts", import.meta.url), "utf8");
  assert.match(rosterTools, /export function registerRosterTools/);
  assert.match(rosterTools, /name: "crew_register"/);
  assert.match(rosterTools, /name: "crew_finish_close"/);
});
