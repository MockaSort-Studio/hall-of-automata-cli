import { strict as assert } from "node:assert";
import test from "node:test";
import { ARMORY_SIDECAR_PATH, createProvisioningTarget } from "../../.pi/extensions/hall-crew/env-runtime/lib/env-provisioning-target.mjs";

const material = {
  suite: "collaboration/pi-github-tools",
  package: { name: "@mockasort-studio/pi-github-tools", version: "0.1.2", integrity: "sha512-test" },
  native: { command: "gh", system: { probe: ["--version"] } },
  tools: ["github_issue_view"],
};
const packagePath = "/opt/hall/armory/node_modules/@mockasort-studio/pi-github-tools/package.json";

function guest(files, calls) {
  return {
    fs: { readFile: async (file) => files[file] ?? Promise.reject(new Error("missing")) },
    exec: async (argv) => (calls.push(argv), { exitCode: 0 }),
  };
}

test("provisioning target accepts a sidecar only when package and native probe verify in guest", async () => {
  const calls = [];
  const files = {
    [ARMORY_SIDECAR_PATH]: JSON.stringify({ suites: [material] }),
    [packagePath]: JSON.stringify({ name: material.package.name, version: material.package.version }),
  };
  const target = createProvisioningTarget({ guest: guest(files, calls), installPackage: async () => {}, ensureNative: async () => {} });
  assert.deepEqual(await target.findVerifiedSuite({ suite: material.suite }), material);
  assert.deepEqual(calls, [["/usr/bin/env", "gh", "--version"]]);
});

test("materialization verifies the installed guest package and native tool", async () => {
  const calls = [];
  const files = { [packagePath]: JSON.stringify({ name: material.package.name, version: material.package.version }) };
  const installed = [];
  const target = createProvisioningTarget({
    guest: guest(files, calls),
    installPackage: async (pkg, root) => installed.push([pkg, root]),
    ensureNative: async (native) => calls.push(["ensure", native.command]),
  });
  assert.deepEqual(await target.materializeSuite(material), material);
  assert.deepEqual(installed, [[material.package, "/opt/hall/armory"]]);
  assert.deepEqual(calls, [["ensure", "gh"], ["/usr/bin/env", "gh", "--version"]]);
});
