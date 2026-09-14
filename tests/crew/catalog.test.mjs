import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AUTOMATA } from "../../.pi/extensions/crew/lib/roster.mjs";
test("catalog has compact routing discriminants", () => {
  assert.deepEqual(AUTOMATA["hamlet"].routing, ["c++", "real-time-systems", "embedded", "build-systems"]);
  assert.deepEqual(AUTOMATA["panoramix"].routing, ["elixir", "erlang", "beam", "phoenix"]);
  assert.ok(AUTOMATA["old-major"].routing.includes("planning"));
  assert.ok(AUTOMATA["tomashco"].routing.includes("backend"));
});
