import { strict as assert } from "node:assert";
import test from "node:test";
import { createGondolinProvisioningTarget } from "../../.pi/extensions/hall-crew/env-runtime/lib/gondolin-env-provider.mjs";

const material = {
  suite: "collaboration/pi-github-tools",
  package: { name: "@mockasort-studio/pi-github-tools", version: "0.1.2", integrity: "sha512-test" },
  native: { command: "gh" },
  tools: ["github_issue_view"],
};

test("Gondolin bridge sends package and native materialization only through guest installers", async () => {
  const calls = [];
  const vm = {
    fs: {
      readFile: async (file) => {
        if (file.endsWith("package.json")) return JSON.stringify({ name: material.package.name, version: material.package.version });
        throw new Error("missing");
      },
    },
    exec: async (argv) => (calls.push(["exec", argv]), { exitCode: 0 }),
  };
  const target = createGondolinProvisioningTarget(vm, {
    installPackage: async (pkg) => calls.push(["package", pkg.name]),
    ensureNative: async (native) => calls.push(["native", native.command]),
  });
  await target.materializeSuite(material);
  assert.deepEqual(calls, [
    ["package", "@mockasort-studio/pi-github-tools"],
    ["native", "gh"],
    ["exec", ["/usr/bin/env", "gh", "--version"]],
  ]);
});
