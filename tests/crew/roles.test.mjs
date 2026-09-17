import { strict as assert } from "node:assert";
import { test } from "node:test";
import { roleModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/role.mjs";
import { assemble } from "../../.pi/extensions/crew/lib/assembly.mjs";

test("roles provide bounded native capabilities", () => {
  for (const [role, tool, thinking] of [
    ["lead", undefined, "medium"],
    ["architect", "read", "high"],
    ["advisor", "read", "low"],
    ["developer", "edit", "medium"],
  ]) {
    const result = roleModule({ role, override: {} });
    assert.match(result.instructions, /RESPONSIBILITIES/);
    if (tool) assert.ok(result.tools.includes(tool));
    assert.equal(result.thinking, thinking);
  }
});

test("base Crew policy is Comm-only", () => {
  const lead = roleModule({ role: "lead", override: {} });
  const architect = assemble("tomashco", "architect", "");
  assert.match(lead.instructions, /comm_request/);
  assert.match(lead.instructions, /comm_notify/);
  assert.doesNotMatch(lead.instructions, /crew_kickoff|github_discussion/);
  assert.match(architect.instructions, /SDK Comm is the Crew coordination channel/);
  assert.doesNotMatch(architect.instructions, /github_discussion|crew_ask|Discussion is the durable/);
  assert.deepEqual(lead.tools, []);
  assert.ok(!architect.tools.some((tool) => tool.startsWith("github_") || tool.startsWith("crew_")));
});

test("developer has bounded implementation authority", () => {
  const result = roleModule({ role: "developer", override: {} });
  for (const tool of ["read", "edit", "write", "bash"]) assert.ok(result.tools.includes(tool));
  assert.match(result.instructions, /Plan before editing/);
});
test("unknown roles fail", () => assert.throws(() => roleModule({ role: "wizard", override: {} }), /not defined/));
