import { strict as assert } from "node:assert";
import test from "node:test";
import { collectLaunchCredentials, secretEnvFor } from "../../.pi/extensions/hall-crew/env-runtime/lib/launch-credentials.mjs";

const github = ["collaboration/pi-github-tools"];
const never = async () => assert.fail("the login must not run");

test("an environment variable is used as is, with no prompt and no login", async () => {
  const result = await collectLaunchCredentials({
    suiteIds: github,
    environment: { GITHUB_TOKEN: "x" },
    confirm: never,
    run: never,
  });
  assert.deepEqual(result, { secrets: {}, status: { GITHUB_TOKEN: "environment" }, warnings: [] });
});

test("with consent, the named login supplies the token and it is held in memory", async () => {
  const asked = [];
  const result = await collectLaunchCredentials({
    suiteIds: github,
    environment: {},
    confirm: async (request) => (asked.push(request), true),
    run: async (command) => (assert.deepEqual(command, ["gh", "auth", "token"]), "gho_secret"),
  });
  assert.deepEqual(asked, [{ label: "GitHub CLI login", variable: "GITHUB_TOKEN" }]);
  assert.deepEqual(result.secrets, { GITHUB_TOKEN: "gho_secret" });
  assert.equal(result.status.GITHUB_TOKEN, "GitHub CLI login (consented)");
  assert.deepEqual(result.warnings, []);
  assert.doesNotMatch(JSON.stringify({ status: result.status, warnings: result.warnings }), /gho_secret/);
});

test("without consent the login never runs and the gap is a warning", async () => {
  const result = await collectLaunchCredentials({ suiteIds: github, environment: {}, confirm: async () => false, run: never });
  assert.deepEqual(result.secrets, {});
  assert.equal(result.status.GITHUB_TOKEN, "missing");
  assert.match(result.warnings.join(" "), /GITHUB_TOKEN is not available/);
});

test("a headless launch (no way to ask) never reads a login", async () => {
  const result = await collectLaunchCredentials({ suiteIds: github, environment: {}, run: never });
  assert.equal(result.status.GITHUB_TOKEN, "missing");
  assert.equal(result.warnings.length, 1);
});

test("a login that fails or returns nothing is reported, not fatal", async () => {
  const failing = await collectLaunchCredentials({ suiteIds: github, environment: {}, confirm: async () => true, run: async () => Promise.reject(new Error("no gh")) });
  assert.equal(failing.status.GITHUB_TOKEN, "missing");
  assert.match(failing.warnings.join(" "), /did not provide GITHUB_TOKEN/);
});

test("suites with no credential need nothing", async () => {
  assert.deepEqual(await collectLaunchCredentials({ suiteIds: [], environment: {} }), { secrets: {}, status: {}, warnings: [] });
});

test("each worker receives only the secrets its own suites need", () => {
  const secrets = { GITHUB_TOKEN: "t" };
  const withGithub = { environmentProfile: { suites: [{ suite: "collaboration/pi-github-tools" }] } };
  const without = { environmentProfile: { suites: [] } };
  assert.deepEqual(secretEnvFor(withGithub, secrets), { GITHUB_TOKEN: "t" });
  assert.equal(secretEnvFor(without, secrets), undefined);
  assert.equal(secretEnvFor(withGithub, {}), undefined);
});
