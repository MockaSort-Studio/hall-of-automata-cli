// tests/crew/roles.test.mjs
// Unit tests for all crew role discipline functions.
import { strict as assert } from "node:assert";
import { test } from "node:test";

const BASE = "../../.pi/extensions/crew/lib/automaton-body/lib";

async function loadRole(name) {
  return (await import(`${BASE}/roles/${name}.mjs`));
}

test("leadRole exposes review and Crew communication tools", async () => {
  const { leadRole } = await loadRole("lead");
  const r = leadRole();
  assert.ok(r.discipline.includes("orchestrate") || r.discipline.includes("LEAD"), "discipline missing lead intent");
  assert.ok(r.tools.includes("crew_kickoff"));
  assert.ok(r.tools.includes("crew_register"));
  assert.ok(r.tools.includes("crew_unregister"));
  assert.ok(r.tools.includes("crew_begin_human_close"));
  assert.ok(r.tools.includes("crew_finish_human_close"));
  assert.ok(r.tools.includes("crew_post"));
  assert.ok(r.tools.includes("crew_review"));
  assert.ok(r.tools.includes("crew_reply"));
  assert.ok(r.tools.includes("crew_close"));
  assert.ok(r.tools.includes("crew_poll_human_requests"));
  assert.ok(r.tools.includes("crew_ack_human_requests"));
  assert.ok(!r.tools.includes("write"));
  assert.equal(r.defaultThinking, "medium");
});

test("architectRole returns discipline, read-only tools, high thinking", async () => {
  const { architectRole } = await loadRole("architect");
  const r = architectRole();
  assert.ok(r.discipline.includes("Advising"), "discipline missing Advising mode");
  assert.ok(r.tools.includes("read"), "missing read tool");
  assert.ok(!r.tools.includes("write"), "architect must not have write tool");
  assert.ok(!r.tools.includes("edit"),  "architect must not have edit tool");
  assert.equal(r.defaultThinking, "high");
  assert.ok(r.tools.includes("crew_reply"));
});

test("developerRole returns discipline, write tools, medium thinking", async () => {
  const { developerRole } = await loadRole("developer");
  const r = developerRole();
  assert.ok(r.discipline.includes("Doing"), "discipline missing Doing mode");
  assert.ok(r.tools.includes("write"), "developer must have write tool");
  assert.ok(r.tools.includes("edit"),  "developer must have edit tool");
  assert.ok(r.tools.includes("crew_reply"));
  assert.equal(r.defaultThinking, "medium");
});

test("advisorRole returns discipline, read-only tools, low thinking", async () => {
  const { advisorRole } = await loadRole("advisor");
  const r = advisorRole();
  assert.ok(r.discipline.includes("Researching"), "discipline missing Researching mode");
  assert.ok(r.tools.includes("read"), "missing read tool");
  assert.ok(!r.tools.includes("write"), "advisor must not have write tool");
  assert.equal(r.defaultThinking, "low");
  assert.ok(r.tools.includes("crew_reply"));
});

test("roleModule wires all four roles without error", async () => {
  const { roleModule } = await import(`${BASE}/modules/role.mjs`);
  for (const role of ["lead", "architect", "developer", "advisor"]) {
    const result = roleModule({ role, override: {} });
    assert.ok(result.instructions.length > 20, `${role}: instructions too short`);
    assert.ok(Array.isArray(result.tools),      `${role}: tools must be array`);
  }
});

test("roleModule throws for unknown role", async () => {
  const { roleModule } = await import(`${BASE}/modules/role.mjs`);
  assert.throws(() => roleModule({ role: "wizard", override: {} }), /not defined/);
});
