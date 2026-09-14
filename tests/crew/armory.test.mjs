import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ARMORY, resolveArmory } from "../../.pi/extensions/crew/lib/armory.mjs";
import { AUTOMATA } from "../../.pi/extensions/crew/lib/roster.mjs";
test("Armory indexes declared extensions", () => { assert.deepEqual(resolveArmory(["pi-elixir"], ["mix_test"]), { extensions:["pi-elixir"], tools:[] }); });
test("catalog extensions are indexed", () => { for (const a of Object.values(AUTOMATA)) for (const e of a.extensions) assert.ok(e in ARMORY); });
