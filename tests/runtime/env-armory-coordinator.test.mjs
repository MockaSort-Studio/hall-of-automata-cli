import { strict as assert } from "node:assert";
import test from "node:test";
import { acquireArmoryEnvironment } from "../../.pi/extensions/runtime/lib/env-armory-coordinator.mjs";

const profile = { suites: [{ suite: "collaboration/pi-github-tools", tools: ["github_issue_view"] }] };
const cached = {
  suite: "collaboration/pi-github-tools",
  package: { name: "@mockasort-studio/pi-github-tools", version: "0.1.2", integrity: "sha512-test" },
  native: { command: "gh" },
  tools: ["github_issue_view"],
};

test("Env restores a verified sealed disk without Armory materialization", async () => {
  let prepared = false;
  const result = await acquireArmoryEnvironment({
    profile,
    provider: {
      findSealed: async () => "sealed-disk",
      inspectSealed: async () => ({ findVerifiedSuite: async () => cached }),
      restore: async (disk, options) => ({ disk, ...options }),
    },
    prepare: async () => (prepared = true),
  });
  assert.equal(prepared, false);
  assert.equal(result.disk, "sealed-disk");
  assert.equal(result.suites[0].source, "guest-cache");
});

test("Env provisions, materializes, seals, restores, and destroys on a miss", async () => {
  const calls = [];
  const result = await acquireArmoryEnvironment({
    profile,
    provider: {
      findSealed: async () => undefined,
      createProvisioning: async () => (calls.push("create"), "provisioning-vm"),
      provisioningTarget: async () => (calls.push("target"), {}),
      seal: async (vm, sidecar) => (calls.push(`seal:${vm}`), { disk: "sealed-disk", sidecar }),
      restore: async (sealed) => (calls.push("restore"), sealed),
      destroyProvisioning: async (vm) => calls.push(`destroy:${vm}`),
    },
    prepare: async ({ request }) => (calls.push("prepare"), { ...cached, tools: request.tools, source: "provisioned" }),
  });
  assert.equal(result.disk, "sealed-disk");
  assert.deepEqual(calls, ["create", "target", "prepare", "seal:provisioning-vm", "restore", "destroy:provisioning-vm"]);
  assert.equal(result.sidecar.suites[0].source, "provisioned");
});
