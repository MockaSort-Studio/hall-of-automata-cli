import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ARMORY_DOMAINS, resolveArmory } from "../../.pi/extensions/crew/lib/armory.mjs";
import { AUTOMATA } from "../../.pi/extensions/crew/lib/roster.mjs";
test("Armory activates only installed domain tools", () => {
  const result = resolveArmory(["elixir", "phoenix"], ["mix_test", "phoenix_logs"]);
  assert.deepEqual(result.extensions, ["elixir-pi"]);
  assert.deepEqual(result.tools, ["mix_test", "phoenix_logs"]);
  assert.ok(result.missing.includes("elixir_debug_live"));
});
test("Armory covers every current automaton domain", () => {
  for (const actor of Object.values(AUTOMATA)) for (const domain of actor.domain) assert.ok(ARMORY_DOMAINS.includes(domain), domain);
});
