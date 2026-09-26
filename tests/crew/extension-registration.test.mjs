import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../.pi/extensions/crew/index.ts", import.meta.url), "utf8");

test("crew extension imports all tool registration functions", () => {
  assert.match(source, /runtimeFor/);
  assert.match(source, /import.*registerCommunicationTools.*from.*communication-tools/);
  assert.match(source, /import.*registerHumanInboxTools.*from.*human-inbox-tools/);
  assert.match(source, /import.*registerRosterTools.*from.*roster-tools/);
});

test("crew extension wires terminal notifications through Main session flow", () => {
  assert.match(source, /attachTerminalNotifier/);
  assert.match(source, /attachTerminalNotifier\(ctx\)/);
});

test("crew extension calls all tool registration functions", () => {
  assert.match(source, /registerCommunicationTools\(pi\)/);
  assert.match(source, /registerHumanInboxTools\(pi\)/);
  assert.match(source, /registerRosterTools\(pi\)/);
});

test("communication tools module exports registration function", () => {
  const commTools = readFileSync(
    new URL("../../.pi/extensions/crew/lib/communication-tools.ts", import.meta.url),
    "utf8",
  );
  assert.match(commTools, /export function registerCommunicationTools/);
  assert.match(commTools, /name: "crew_kickoff"/);
  assert.match(commTools, /name: "crew_close"/);
});

test("human inbox tools module exports registration function", () => {
  const humanTools = readFileSync(
    new URL("../../.pi/extensions/crew/lib/human-inbox-tools.ts", import.meta.url),
    "utf8",
  );
  assert.match(humanTools, /export function registerHumanInboxTools/);
  assert.match(humanTools, /name: "crew_poll_human_requests"/);
});

test("roster tools module exports registration function", () => {
  const rosterTools = readFileSync(new URL("../../.pi/extensions/crew/lib/roster-tools.ts", import.meta.url), "utf8");
  assert.match(rosterTools, /export function registerRosterTools/);
  assert.match(rosterTools, /name: "crew_register"/);
  assert.match(rosterTools, /name: "crew_finish_close"/);
});
