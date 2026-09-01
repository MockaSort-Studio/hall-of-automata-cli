import { strict as assert } from "node:assert";
import { test } from "node:test";
import { crewPaths, launchCode, parseRepository } from "../../.pi/extensions/crew/lib/startup.mjs";

test("crew paths are relative to the install config directory", () => {
  assert.deepEqual(crewPaths(".pi", "run-1"), {
    roster: ".pi/fabric/crew-launch/run-1-roster.json",
    config: ".pi/fabric/crew-launch/run-1.json",
  });
  assert.deepEqual(crewPaths(".custom", "run-1"), {
    roster: ".custom/fabric/crew-launch/run-1-roster.json",
    config: ".custom/fabric/crew-launch/run-1.json",
  });
});

test("repository coordinates are discovered rather than host-coded", () => {
  assert.deepEqual(parseRepository("owner/repository\n"), {
    owner: "owner",
    repo: "repository",
  });
  assert.throws(() => parseRepository("repository"), /Unable to resolve/);
});

test("launch code uses Fabric APIs and relative config paths", () => {
  const code = launchCode(".custom/fabric/crew-launch/run-1.json");
  assert.match(code, /agents\.create\(cfg\.lead\)/);
  assert.match(code, /agents\.tell/);
  assert.match(code, /status: 'started'/);
  assert.match(code, /roster\.status = 'failed'/);
  assert.match(code, /agents\.remove/);
  assert.ok(!code.includes("/Users/"));
  assert.ok(!code.includes("Workspace/"));
});
