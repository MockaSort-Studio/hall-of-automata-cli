import { strict as assert } from "node:assert";
import test from "node:test";
import { ensureGuestNative, installGuestPackage } from "../../.pi/extensions/hall-crew/env-runtime/lib/gondolin-guest-installer.mjs";

const pkg = { name: "@mockasort-studio/pi-github-tools", version: "0.1.2", integrity: "sha512-test" };

test("guest npm install requires the Armory-pinned lockfile integrity", async () => {
  const calls = [];
  const guest = {
    exec: async (argv) => (calls.push(argv), { exitCode: 0 }),
    fs: { readFile: async () => JSON.stringify({ packages: { "node_modules/@mockasort-studio/pi-github-tools": { integrity: "sha512-test" } } }) },
  };
  await installGuestPackage(guest, pkg);
  assert.deepEqual(calls, [["/usr/bin/npm", "install", "--prefix", "/opt/hall/armory", "--ignore-scripts", "--package-lock=true", "@mockasort-studio/pi-github-tools@0.1.2"]]);
});

test("native resolution uses a successful guest system probe without downloading", async () => {
  const calls = [];
  const result = await ensureGuestNative(
    { exec: async (argv) => (calls.push(argv), { exitCode: 0 }), fs: {} },
    { command: "gh", system: { probe: ["--version"] } },
    { platform: "linux-arm64" },
  );
  assert.deepEqual(result, { source: "system", command: "gh" });
  assert.deepEqual(calls, [["/usr/bin/env", "gh", "--version"]]);
});

test("native resolution rejects an unpinned guest fallback", async () => {
  await assert.rejects(
    ensureGuestNative(
      { exec: async () => ({ exitCode: 1 }), fs: {} },
      { command: "gh", cacheFallback: { "linux-arm64": { url: "https://bad.test/gh" } } },
      { platform: "linux-arm64" },
    ),
    /No verified guest fallback/,
  );
});
