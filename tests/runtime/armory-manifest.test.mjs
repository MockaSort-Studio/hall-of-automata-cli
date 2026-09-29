import { strict as assert } from "node:assert";
import test from "node:test";
import { resolveLiveArmorySuite, resolveLiveArmoryToolSuites } from "../../.pi/extensions/runtime/lib/armory-manifest.mjs";

const catalogUrl = "https://example.test/manifest.json";
const suiteUrl = "https://example.test/collaboration/github/manifest.json";
const catalog = {
  format: "hall.armory/v1",
  lockers: [{ name: "collaboration", suites: [{ extension: "github", manifest: "collaboration/github/manifest.json" }] }],
};
const suite = {
  format: "hall.armory-suite/v1",
  extension: "github",
  package: {
    name: "@mockasort-studio/pi-github-tools",
    version: "0.1.2",
    integrity: "sha512-test",
  },
  native: { closure: "./nix" },
  tools: ["github_issue_view", "github_pull_request_view"],
};

function fetcher(documents) {
  return async (url) => ({ ok: true, status: 200, json: async () => documents[url] });
}

test("live Armory resolution follows the catalog suite path and narrows tools", async () => {
  const resolved = await resolveLiveArmorySuite({
    suite: "collaboration/github",
    tools: ["github_issue_view"],
    catalogUrl,
    fetcher: fetcher({ [catalogUrl]: catalog, [suiteUrl]: suite }),
  });
  assert.equal(resolved.manifestUrl, suiteUrl);
  assert.equal(resolved.suite.package.name, "@mockasort-studio/pi-github-tools");
  assert.deepEqual(resolved.suite.tools, ["github_issue_view"]);
});

test("live Armory profile resolution groups only requested catalog operations", async () => {
  const suites = await resolveLiveArmoryToolSuites({
    tools: ["read", "github_pull_request_view"],
    catalogUrl,
    fetcher: fetcher({ [catalogUrl]: catalog, [suiteUrl]: suite }),
  });
  assert.deepEqual(suites, [{ suite: "collaboration/github", tools: ["github_pull_request_view"] }]);
});

test("live Armory resolution rejects tools absent from the suite allowlist", async () => {
  await assert.rejects(
    resolveLiveArmorySuite({
      suite: "collaboration/github",
      tools: ["github_not_real"],
      catalogUrl,
      fetcher: fetcher({ [catalogUrl]: catalog, [suiteUrl]: suite }),
    }),
    /undeclared tools/,
  );
});
