import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { governance } from "../../.pi/extensions/crew/lib/governance.mjs";
import { crewDisciplineModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/crew-discipline.mjs";

const base = { topic: "crew.test", runId: "test", rosterFile: "/tmp/roster.json", outputPath: "out.md" };
const protocol = governance(base);
const human = governance({ ...base, completionMode: "human-gated", leadTickTopic: "crew.test.lead-tick" });
const tools = readFileSync(new URL("../../.pi/extensions/crew/lib/communication-tools.ts", import.meta.url), "utf8");

test("dispatch is a bounded create-register-wake transaction", () => {
  for (const term of ["crew_kickoff", "build_crew_member", "agents.create", "crew_register", "agents.ask", "crew_unregister"]) assert.ok(protocol.includes(term));
  assert.doesNotMatch(protocol, /supervisor/);
  assert.match(protocol, /never post “dispatched”/);
});

test("protocol preserves Crew ownership and low-noise decisions", () => {
  const discipline = crewDisciplineModule().instructions;
  assert.match(discipline, /Use only registered crew_\* tools/);
  assert.match(discipline, /Only the Lead manages Crew actor lifecycle/);
  assert.match(protocol, /material Lead decision/);
  assert.match(protocol, /Do not review a review/);
  assert.match(protocol, /agents\.ask\/tell for operational dispatch/);
  assert.match(tools, /Only the Crew Lead may broadcast/);
  assert.match(tools, /Threaded replies must name one recipient, never @all/);
});

test("human closure has a durable terminal sequence", () => {
  for (const term of ["crew_poll_human_requests", "request.threadRootId", "crew_begin_human_close", "crew_finish_human_close", "members is empty"]) assert.ok(human.includes(term));
  assert.match(protocol, /crew_close once/);
});
