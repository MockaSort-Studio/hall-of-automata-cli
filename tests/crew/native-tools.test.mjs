import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crewNativeToolNames, withCrewNativeToolVisibility } from "../../.pi/extensions/crew/lib/native-tools.mjs";

const config = JSON.parse(readFileSync(".pi/fabric.json", "utf8"));

test("native manifest includes every role-used extension tool and no Pi core tool", () => {
  const names = crewNativeToolNames();
  for (const name of [
    "github_discussion_view",
    "github_discussion_comments",
    "crew_kickoff",
    "crew_post",
    "crew_finish_close",
  ]) {
    assert.ok(names.includes(name), `${name} must be native`);
  }
  for (const core of ["read", "grep", "find", "ls", "bash", "edit", "write"]) assert.ok(!names.includes(core));
});

test("Fabric visibility configuration is generated from the native manifest", () => {
  const expected = withCrewNativeToolVisibility(config).capture.keepVisible;
  assert.deepEqual(config.capture.keepVisible, expected);
});
