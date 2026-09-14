import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolveArmory } from "../../.pi/extensions/crew/lib/armory.mjs";
test("Armory activates only installed domain tools", () => {
  const result = resolveArmory(["elixir", "phoenix"], ["mix_test", "phoenix_logs"]);
  assert.deepEqual(result.extensions, ["elixir-pi"]);
  assert.deepEqual(result.tools, ["mix_test", "phoenix_logs"]);
  assert.ok(result.missing.includes("elixir_debug_live"));
});
