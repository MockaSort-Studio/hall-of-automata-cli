import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ARMORY } from "../../.pi/extensions/crew/lib/armory.mjs";
test("Armory is a declarative extension index", () => assert.deepEqual(ARMORY, { "pi-elixir": {} }));
