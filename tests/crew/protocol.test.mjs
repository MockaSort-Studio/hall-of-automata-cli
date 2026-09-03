// tests/crew/protocol.test.mjs
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { governance } from "../../.pi/extensions/crew/lib/governance.mjs";
import { crewDisciplineModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/crew-discipline.mjs";
import { leadRole } from "../../.pi/extensions/crew/lib/automaton-body/lib/roles/lead.mjs";

const protocol = governance({ topic: "crew.test", runId: "test", rosterFile: "/tmp/roster.json", outputPath: "out.md" });

test("initial dispatch uses kickoff constructor context, not a URL-only tell", () => {
  assert.match(protocol, /crew_kickoff/);
  assert.match(protocol, /build_crew_member/);
  assert.match(protocol, /agents\.create/);
  assert.match(protocol, /crew_register/);
  assert.match(protocol, /agents\.ask/);
  assert.match(protocol, /resident owner/);
  assert.doesNotMatch(protocol, /roster\.supervisor|operation:"RECRUIT"/);
  assert.doesNotMatch(protocol, /publish START/);
});

test("crew Discussion content is wrapper-owned", () => {
  const discipline = crewDisciplineModule().instructions;
  assert.match(discipline, /Use only registered crew_\* tools/);
  assert.match(discipline, /Never call github_discussion_\* directly/);
  assert.match(protocol, /Immediately call crew_register/);
  assert.match(protocol, /agents\.remove/);
  assert.match(protocol, /removed:true/);
  assert.match(protocol, /Never use\s+agents\.stop as disbanding/);
  assert.match(discipline, /stop only pauses.*retains/i);
  assert.match(discipline, /Only the Lead manages Crew actor lifecycle/i);
  assert.match(discipline, /never call agents\.stop or agents\.remove/i);
  assert.match(protocol, /crew_reply\(replyToId:commentId/);
  assert.match(protocol, /commentId and commentUrl to the topic/);
  assert.match(protocol, /Mesh carries DONE, BLOCKED, FINAL, broadcast, and future control signals only/);
});

test("lead treats every DONE as a substantive review gate", () => {
  assert.match(protocol, /DONE is a review event/);
  assert.match(protocol, /ACCEPT, REVISE, CONFLICT, or RELEASE DEPENDENCY/);
  const lead = leadRole();
  assert.match(lead.discipline, /active reviewer and integrator/);
  assert.ok(lead.tools.includes("crew_review"));
  assert.ok(lead.tools.includes("crew_close"));
  assert.match(protocol, /Publish FINAL only after crew_close/);
  assert.match(protocol, /agents\.followUp\(\{ id:"main"/);
  assert.match(protocol, /kind:"crew_result"/);
  assert.match(protocol, /status:"closed"/);
  assert.match(protocol, /outcome:"PASS"/);
  assert.match(protocol, /summary:"<concise outcome>"/);
  assert.ok(protocol.indexOf('id:"main"') < protocol.indexOf("remove every specialist"));
});
