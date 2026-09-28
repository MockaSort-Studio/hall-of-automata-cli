import { strict as assert } from "node:assert";
import test from "node:test";
import {
  gondolinCacheHome,
  preflightWorkerSandbox,
  requiredQemuBinary,
} from "../../.pi/extensions/runtime/lib/sandbox-preflight.mjs";

test("uses the Pi cache only when no XDG cache is configured", () => {
  assert.equal(gondolinCacheHome({ XDG_CACHE_HOME: "/shared-cache" }), "/shared-cache");
  assert.match(gondolinCacheHome({}), /\.pi\/agent\/cache$/);
});

test("selects the QEMU binary for the host architecture", () => {
  assert.equal(requiredQemuBinary("darwin", "arm64"), "qemu-system-aarch64");
  assert.equal(requiredQemuBinary("linux", "x64"), "qemu-system-x86_64");
});

test("preflight verifies QEMU then downloads verified guest assets into the chosen cache", async () => {
  const environment = {};
  const calls = [];
  await preflightWorkerSandbox(
    { sandbox: { kind: "gondolin" } },
    {
      environment,
      verifyQemu: (binary) => calls.push(binary),
      verifyQemuImage: () => calls.push("qemu-img"),
      gondolin: { ensureGuestAssets: async () => calls.push("assets") },
    },
  );
  assert.match(environment.XDG_CACHE_HOME, /\.pi\/agent\/cache$/);
  assert.deepEqual(calls, [requiredQemuBinary(), "qemu-img", "assets"]);
});

test("preflight does not download assets if QEMU is unavailable", async () => {
  await assert.rejects(
    preflightWorkerSandbox(
      { sandbox: { kind: "gondolin" } },
      {
        verifyQemu: () => {
          throw new Error("QEMU absent");
        },
        verifyQemuImage: () => assert.fail("should not verify image tool"),
        gondolin: { ensureGuestAssets: async () => assert.fail("should not download") },
      },
    ),
    /QEMU absent/,
  );
});
