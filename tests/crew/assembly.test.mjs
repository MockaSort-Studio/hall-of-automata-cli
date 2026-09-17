import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assemble } from "../../.pi/extensions/crew/lib/assembly.mjs";
test("assembly embeds bounded work without adapter tools", () => {
  const actor = assemble("mergio", "architect", "Design one focused behavior and prove it.");
  assert.match(actor.instructions, /## BOUNDED ASSIGNMENT/);
  assert.ok(!actor.tools.some((tool) => tool.startsWith("crew_") || tool.startsWith("github_")));
});
test("assembly does not claim unverified Armory tools", () => {
  const actor = assemble("panoramix", "developer", "Implement one BEAM change.");
  assert.ok(!actor.tools.includes("mix_test"));
});
test("assembly rejects oversized work", () =>
  assert.throws(() => assemble("mergio", "architect", "x".repeat(4001)), /exceeds 4000/));
