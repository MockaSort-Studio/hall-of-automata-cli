import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ARMORY, resolveArmoryExtensions } from "../../.pi/extensions/crew/lib/armory.mjs";
test("Armory has no unverified extension declarations", () => assert.deepEqual(ARMORY, {}));
test("Armory rejects undeclared extensions", () => assert.throws(() => resolveArmoryExtensions(["pi-elixir"], []), /absent from the Armory/));
