import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crewNativeToolNames, withCrewNativeToolVisibility } from "../../.pi/extensions/crew/lib/native-tools.mjs";
const config = JSON.parse(readFileSync(".pi/fabric.json", "utf8"));
test("base Crew native manifest excludes core and deferred adapter tools", () => {
  const names = crewNativeToolNames();
  assert.ok(!names.some((name) => name.startsWith("github_") || name.startsWith("crew_")));
  for (const core of ["read", "grep", "find", "ls", "bash", "edit", "write"]) assert.ok(!names.includes(core));
});
test("Fabric visibility configuration is generated from the native manifest", () =>
  assert.deepEqual(config.capture.keepVisible, withCrewNativeToolVisibility(config).capture.keepVisible));
