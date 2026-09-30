import { strict as assert } from "node:assert";
import test from "node:test";
import { prepareArmorySuite } from "../../.pi/extensions/hall-crew/env-runtime/lib/armory-handler.mjs";

const request = { suite: "collaboration/pi-github-tools", tools: ["github_issue_view"] };

test("a verified guest-disk suite is reused without live manifest resolution", async () => {
  let resolved = false;
  let materialized = false;
  const result = await prepareArmorySuite({
    request,
    target: {
      findVerifiedSuite: async () => ({
        suite: request.suite,
        package: { name: "@mockasort-studio/pi-github-tools", version: "0.1.2", integrity: "sha512-test" },
        tools: ["github_issue_view", "github_pull_request_view"],
        native: { command: "gh" },
      }),
      materializeSuite: async () => (materialized = true),
    },
    resolve: async () => (resolved = true),
  });
  assert.equal(result.source, "guest-cache");
  assert.equal(resolved, false);
  assert.equal(materialized, false);
});

test("a guest-disk miss resolves and materializes the fixed suite profile", async () => {
  const calls = [];
  const result = await prepareArmorySuite({
    request,
    target: {
      findVerifiedSuite: async () => undefined,
      materializeSuite: async (profile) => {
        calls.push(profile);
        return { ...profile, verified: true };
      },
    },
    resolve: async () => ({
      catalogUrl: "https://catalog.test/manifest.json",
      manifestUrl: "https://catalog.test/collaboration/github/manifest.json",
      suite: {
        package: { name: "@mockasort-studio/pi-github-tools", version: "0.1.2", integrity: "sha512-test" },
        native: { command: "gh" },
        tools: request.tools,
      },
    }),
  });
  assert.equal(result.source, "provisioned");
  assert.equal(result.verified, true);
  assert.deepEqual(calls[0].tools, request.tools);
  assert.equal(calls[0].package.name, "@mockasort-studio/pi-github-tools");
});
