import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { governance } from "../../.pi/extensions/crew/lib/governance.mjs";
import { leadDiscipline, specialistDiscipline } from "../../.pi/extensions/crew/lib/policy.mjs";
import { crewDisciplineModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/crew-discipline.mjs";

const base = { topic: "crew.test", runId: "test", rosterFile: "/tmp/roster.json", outputPath: "out.md" };
const protocol = governance(base);
const human = governance({ ...base, completionMode: "human-gated", leadTickTopic: "crew.test.lead-tick" });
const tools = readFileSync(new URL("../../.pi/extensions/crew/lib/communication-tools.ts", import.meta.url), "utf8");

test("the run assignment carries only run state and its bounded transaction", () => {
  for (const term of ["crew_kickoff", "build_crew_member", "agents.create", "crew_register", "agents.ask", "crew_unregister", "request.threadRootId"]) {
    assert.ok(protocol.includes(term), `missing ${term}`);
  }
  assert.doesNotMatch(protocol, /supervisor/);
  assert.ok(protocol.length < 1600, "run assignment must stay compact");
});

test("discipline lives in one place per audience", () => {
  assert.match(leadDiscipline(), /Publish only evidence and changed decisions/);
  assert.match(leadDiscipline(), /smallest complementary roster/);
  assert.match(specialistDiscipline(), /Request peer input only for conflicting findings/);
  assert.match(crewDisciplineModule().instructions, /Only the Lead manages lifecycle/);
  assert.doesNotMatch(protocol, /Publish only evidence and changed decisions/);
  assert.doesNotMatch(crewDisciplineModule().instructions, /DONE or BLOCKED with its URL/);
});

test("communication wrappers enforce authority and threading", () => {
  assert.match(tools, /Only the Crew Lead may broadcast/);
  assert.match(tools, /Threaded replies must name one recipient, never @all/);
});

test("each completion mode has a verified terminal sequence", () => {
  for (const term of ["crew_poll_human_requests", "crew_begin_close", "crew_finish_close", "members is empty"]) {
    assert.ok(human.includes(term), `missing ${term}`);
  }
  assert.match(protocol, /crew_close once/);
  assert.match(protocol, /crew_finish_close/);
});
