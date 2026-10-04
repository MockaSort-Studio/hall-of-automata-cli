import { strict as assert } from "node:assert";
import test from "node:test";
import { checkLaunchCredentials } from "../../.pi/extensions/hall-crew/env-runtime/lib/launch-credentials.mjs";
import { credentialPolicyForSuites } from "../../.pi/extensions/hall-crew/env-runtime/credential-policy.mjs";

const github = ["collaboration/pi-github-tools"];

test("the dedicated Hall variable satisfies the binding", () => {
  assert.deepEqual(checkLaunchCredentials({ suiteIds: github, environment: { HALL_GITHUB_TOKEN: "x" } }), {
    status: { HALL_GITHUB_TOKEN: "environment" },
    warnings: [],
  });
});

test("an unrelated GITHUB_TOKEN is never taken, so it cannot leak to workers by accident", () => {
  const result = checkLaunchCredentials({ suiteIds: github, environment: { GITHUB_TOKEN: "broad-token-for-other-tools" } });
  assert.equal(result.status.HALL_GITHUB_TOKEN, "missing");
});

test("a missing token is a warning that says how to create and store one", () => {
  const { status, warnings } = checkLaunchCredentials({ suiteIds: github, environment: {} });
  assert.equal(status.HALL_GITHUB_TOKEN, "missing");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /HALL_GITHUB_TOKEN is not set/);
  assert.match(warnings[0], /https:\/\/github\.com\/settings\/personal-access-tokens\/new/);
  assert.match(warnings[0], /fine-grained/);
  assert.match(warnings[0], /scripts\/setup-github-token\.sh/);
});

test("suites with no credential need nothing", () => {
  assert.deepEqual(checkLaunchCredentials({ suiteIds: [], environment: {} }), { status: {}, warnings: [] });
});

test("the guest still sees GITHUB_TOKEN while the host source is the Hall variable", () => {
  const [binding] = credentialPolicyForSuites(github);
  assert.equal(binding.guestEnvironment, "GITHUB_TOKEN");
  assert.equal(binding.environment, "GITHUB_TOKEN");
  assert.equal(binding.source, "environment:HALL_GITHUB_TOKEN");
});
