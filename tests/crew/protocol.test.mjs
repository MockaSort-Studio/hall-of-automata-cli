// tests/crew/protocol.test.mjs
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { governance } from "../../.pi/extensions/crew/lib/governance.mjs";
import { crewDisciplineModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/crew-discipline.mjs";
import { leadRole } from "../../.pi/extensions/crew/lib/automaton-body/lib/roles/lead.mjs";

const protocol = governance({ topic: "crew.test", runId: "test", rosterFile: "/tmp/roster.json", outputPath: "out.md" });

test("initial dispatch uses kickoff constructor context, not a URL-only tell", () => {
  assert.match(protocol, /crew_kickoff/);
  assert.match(protocol, /constructor context is the initial handoff/);
  assert.match(protocol, /Never use crew_tell or crew_ask merely/);
  assert.doesNotMatch(protocol, /publish START/);
});

test("crew Discussion content is wrapper-owned", () => {
  const discipline = crewDisciplineModule().instructions;
  assert.match(discipline, /crew_kickoff, crew_post, crew_tell, crew_ask, and crew_broadcast/);
  assert.match(discipline, /Never call github_discussion_\* directly/);
  assert.match(protocol, /Mesh carries DONE, BLOCKED, FINAL, broadcast, and future control signals only/);
});

test("lead treats every DONE as a substantive review gate", () => {
  assert.match(protocol, /DONE is a review event/);
  assert.match(protocol, /ACCEPT, REVISE, CONFLICT, or RELEASE DEPENDENCY/);
  assert.match(leadRole().discipline, /active reviewer and integrator/);
});
