import assert from "node:assert/strict";
import test from "node:test";
import { workerArmoryConfig } from "../../.pi/extensions/runtime/lib/worker-armory-config.mjs";

const path = "/nix/store/0123456789abcdefghijklmnopqrstuv-github";

test("worker Armory config exposes only exact mount paths and grants", () => {
  assert.deepEqual(workerArmoryConfig({ armory: { nixPaths: [path], suites: [{ rootPath: path, tools: ["github_issue_view"] }] } }), {
    paths: [path], suites: [{ rootPath: path, tools: ["github_issue_view"] }],
  });
});

test("worker Armory config rejects a broad Nix mount", () => {
  assert.throws(() => workerArmoryConfig({ armory: { nixPaths: ["/nix/store"], suites: [] } }), /invalid Nix mount/);
});
