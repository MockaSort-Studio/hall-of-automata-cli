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
    ["integrator", "edit", "low"],
    ["reviewer", "bash", "medium"],
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

test("integrator has bounded reconciliation authority", () => {
  const result = roleModule({ role: "integrator", override: {} });
  for (const tool of ["read", "edit", "write", "bash"]) assert.ok(result.tools.includes(tool));
  assert.match(result.instructions, /not a Lead/);
});

test("reviewer has review-only authority", () => {
  const result = roleModule({ role: "reviewer", override: {} });
  for (const tool of ["read", "grep", "find", "ls", "bash", "github_pull_request_view"])
    assert.ok(result.tools.includes(tool));
  for (const tool of ["edit", "write", "github_pull_request_merge"]) assert.ok(!result.tools.includes(tool));
  assert.match(result.instructions, /REQUEST_CHANGES/);
});

test("developer has bounded implementation authority", () => {
  const result = roleModule({ role: "developer", override: {} });
  for (const tool of ["read", "edit", "write", "bash"]) assert.ok(result.tools.includes(tool));
  assert.match(result.instructions, /Plan before editing/);
});
test("unknown roles fail", () => assert.throws(() => roleModule({ role: "wizard", override: {} }), /not defined/));

test("only the lead role is granted the party-wide broadcast tool", () => {
  for (const role of ["architect", "advisor", "developer", "integrator", "reviewer"]) {
    const result = roleModule({ role, override: {} });
    assert.ok(!result.commTools.includes("comm_notify_all"), `${role} must not have comm_notify_all`);
    assert.ok(!result.commTools.includes("comm_notify_many"), `${role} must not have comm_notify_many`);
    assert.deepEqual(result.commTools, ["comm_notify", "comm_request", "comm_reply"]);
  }
  const lead = roleModule({ role: "lead", override: {} });
  assert.ok(lead.commTools.includes("comm_notify_all"));
});
