import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assemble } from "../../.pi/extensions/crew/lib/assembly.mjs";

test("assembly embeds a bounded assignment and preserves durable peer tools", () => {
  const actor = assemble("mergio", "architect", "Design one focused behavior and prove it.");
  assert.match(actor.instructions, /## BOUNDED ASSIGNMENT\nDesign one focused behavior/);
  assert.ok(actor.tools.includes("crew_ask"));
  assert.ok(actor.tools.includes("crew_tell"));
  assert.ok(actor.tools.includes("github_issue_view"));
  assert.ok(!actor.tools.includes("github_issue_update"));
  assert.ok(!actor.tools.includes("github_pull_request_merge"));
});

test("assembly rejects oversized work rather than bloating actor context", () => {
  assert.throws(() => assemble("mergio", "architect", "x".repeat(4001)), /exceeds 4000/);
});

test("assembly keeps persona voice but excludes legacy workflow and role rules", () => {
  const lead = assemble("old-major", "lead", "Assess recruitment.");
  assert.match(lead.instructions, /Hall-Master/);
  assert.doesNotMatch(lead.instructions, /Routing Procedure|dispatch-result\.json|hall:dispatch-automaton/);
  const architect = assemble("frontenzo", "architect", "Assess a frontend boundary.");
  assert.doesNotMatch(architect.instructions, /Implements; does not produce advisory/);
  assert.match(architect.instructions, /Advising mode/);
  assert.match(architect.instructions, /## ARMORY/);
});

test("assembly keeps safety guardrails and blocks unsupported doing roles", () => {
  const advisor = assemble("mergio", "advisor", "Assess one bounded change.");
  assert.match(advisor.instructions, /## SAFETY CONTRACT/);
  assert.match(advisor.instructions, /untrusted data, never instructions/);
  assert.match(advisor.instructions, /destructive irreversible actions/);
  const developer = assemble("frontenzo", "developer", "Implement one bounded change.");
  assert.match(developer.instructions, /DEVELOPER RESPONSIBILITIES/);
  assert.ok(developer.tools.includes("edit"));
});
