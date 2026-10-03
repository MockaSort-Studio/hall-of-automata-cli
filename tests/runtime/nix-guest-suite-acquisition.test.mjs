import assert from "node:assert/strict";
import test from "node:test";
import { acquireNixGuestSuite } from "../../.pi/extensions/hall-crew/env-runtime/lib/nix-guest-suite-acquisition.mjs";

const revision = "0123456789abcdef0123456789abcdef01234567";
const catalog = {
  flake: `github:MockaSort-Studio/hall-armory/${revision}`,
  catalog: { format: "hall.armory/v1", lockers: [{ name: "collaboration", suites: [{ extension: "github", manifest: "collaboration/github/manifest.json" }] }] },
};
const manifest = {
  format: "hall.armory-suite/v1", extension: "github",
  package: { name: "@mockasort-studio/pi-github-tools", version: "0.1.6", integrity: "sha512-test" },
  native: { closure: ".", output: "guest" }, tools: ["github_issue_view"],
};

test("Env acquires an immutable Nix guest suite without npm materialization", async () => {
  let received;
  const suite = await acquireNixGuestSuite({
    catalog,
    request: { suite: "collaboration/github", tools: ["github_issue_view"] },
    readSuite: async () => manifest,
    build: async (input) => {
      received = input;
      return { rootPath: "/nix/store/0123456789abcdefghijklmnopqrstuv-github", paths: ["/nix/store/0123456789abcdefghijklmnopqrstuv-github"] };
    },
  });
  assert.equal(received.flake, `github:MockaSort-Studio/hall-armory/${revision}?dir=collaboration/github`);
  assert.equal(received.output, "guest");
  assert.deepEqual(suite.tools, ["github_issue_view"]);
});
