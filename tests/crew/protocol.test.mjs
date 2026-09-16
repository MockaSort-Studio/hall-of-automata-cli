import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { governance } from "../../.pi/extensions/crew/lib/governance.mjs";
import { crewDisciplineModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/crew-discipline.mjs";

const base = { topic: "crew.test", runId: "test", members: [{ name: "architect-tomashco", role: "architect" }] };
const protocol = governance(base);
const human = governance({ ...base, completionMode: "human-gated", leadTickTopic: "crew.test.lead-tick" });
const tools = readFileSync(new URL("../../.pi/extensions/crew/lib/communication-tools.ts", import.meta.url), "utf8");

test("run context carries canonical preassembled member names", () => {
  for (const term of ["CREW CONTEXT", "RUN: test", "TOPIC: crew.test", "MEMBERS: architect-tomashco", "crew_kickoff"]) assert.ok(protocol.includes(term), `missing ${term}`);
  assert.doesNotMatch(protocol, /MEMBERS: @/);
  assert.doesNotMatch(protocol, /supervisor/);
  assert.ok(protocol.length < 1600, "run assignment must stay compact");
});

test("specialist discipline retains the shared-start boundary", () => {
  assert.match(crewDisciplineModule().instructions, /Only the Lead manages lifecycle/);
  assert.match(crewDisciplineModule().instructions, /github_discussion_view/);
});

test("communication wrappers enforce authority, canonical identity, and recovery", () => {
  for (const term of ["assertLead(roster, input.from)", "Only the Crew Lead may broadcast", "Canonical role-persona handle, without @", "kickoffIntent"]) assert.ok(tools.includes(term), `missing ${term}`);
});

test("human-gated context retains its tick and terminal path", () => {
  assert.match(human, /TICK TOPIC: crew.test.lead-tick/);
  assert.match(human, /If started, poll and acknowledge human requests/);
  assert.match(protocol, /close once/);
  assert.match(protocol, /finish closing/);
});
