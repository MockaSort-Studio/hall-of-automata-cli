import { strict as assert } from "node:assert";
import { test } from "node:test";
import { roleModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/role.mjs";
import { assemble } from "../../.pi/extensions/crew/lib/assembly.mjs";

const expected = {
  lead: ["crew_kickoff", "medium"],
  architect: ["read", "high"],
  advisor: ["read", "low"],
  developer: ["edit", "medium"],
};
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
  assert.match(lead.instructions, /mesh\.publish/);
  assert.match(lead.instructions, /never wrap `crew_kickoff` in `fabric_exec`/);
  assert.match(lead.instructions, /MISSING EVIDENCE RECOVERY/);
  assert.match(lead.instructions, /use native `crew_ask` once/);
  assert.match(lead.instructions, /`crew_ask` is the sole Discussion action/);
  assert.match(lead.instructions, /complete the assigned task and record its evidence/);
  assert.match(lead.instructions, /Immediately make one Fabric `agents\.ask` call/);
  const assembledArchitect = assemble("tomashco", "architect", "");
  assert.match(assembledArchitect.instructions, /Call every active non-core `crew_\*` or `github_\*` tool directly/);
  assert.match(assembledArchitect.instructions, /Reserve `fabric_exec` for Fabric-only coordination/);
  assert.match(assembledArchitect.instructions, /exact UUID in activation's `runId` field/);
  assert.match(assembledArchitect.instructions, /topic` is only the mesh topic, never a run ID/);
  assert.match(
    assembledArchitect.instructions,
    /`crew_ask` requests concrete cross-role judgment and `crew_tell` records a material handoff/,
  );
  assert.match(assembledArchitect.instructions, /Specialists do not call `agents\.\*` themselves/);
  assert.match(lead.instructions, /use them directly/);
  assert.match(lead.instructions, /Do not read ROSTER, call `tools\.list`/);
  assert.ok(!lead.tools.includes("build_crew_member"));
  assert.ok(!lead.tools.includes("crew_register"));
  assert.ok(architect.tools.includes("crew_ask"));
  const assembled = assemble("tomashco", "architect", "");
  assert.ok(assembled.tools.includes("github_discussion_view"));
  assert.ok(!assembled.tools.includes("github_issues_list"));
  assert.ok(!assembled.tools.includes("github_project_fields"));
});
test("developer has bounded implementation and validation authority", () => {
  const result = roleModule({ role: "developer", override: {} });
  for (const tool of ["read", "edit", "write", "bash"]) assert.ok(result.tools.includes(tool));
  assert.ok(!result.tools.includes("crew_finish_close"));
  assert.match(result.instructions, /Plan before editing/);
  assert.match(result.instructions, /validation/);
});
test("unknown roles fail", () => assert.throws(() => roleModule({ role: "wizard", override: {} }), /not defined/));
