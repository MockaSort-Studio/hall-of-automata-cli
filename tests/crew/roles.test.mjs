import { strict as assert } from "node:assert";
import { test } from "node:test";
import { roleModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/role.mjs";

const expected = { lead: ["crew_kickoff", "medium"], architect: ["read", "high"], advisor: ["read", "low"], developer: ["edit", "medium"] };
test("canonical role catalog supplies prompt, tools, and thinking", () => {
  for (const [role, [tool, thinking]] of Object.entries(expected)) {
    const result = roleModule({ role, override: {} });
    assert.ok(result.instructions.includes("RESPONSIBILITIES"));
    assert.ok(result.tools.includes(tool));
    assert.equal(result.thinking, thinking);
  }
});
test("roles enforce object-form Fabric calls and shared collaboration", () => {
  const lead = roleModule({ role: "lead", override: {} });
  const architect = roleModule({ role: "architect", override: {} });
  assert.match(lead.instructions, /agents\.ask\(\{ id, message \}\)/);
  assert.ok(architect.tools.includes("crew_ask"));
});
test("developer has bounded implementation and validation authority", () => {
  const result = roleModule({ role: "developer", override: {} });
  for (const tool of ["read", "edit", "write", "bash"]) assert.ok(result.tools.includes(tool));
  assert.ok(!result.tools.includes("crew_finish_close"));
  assert.match(result.instructions, /Plan before editing/);
  assert.match(result.instructions, /validation/);
});
test("unknown roles fail", () => assert.throws(() => roleModule({ role: "wizard", override: {} }), /not defined/));
