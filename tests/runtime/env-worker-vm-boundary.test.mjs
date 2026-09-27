import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acquireWorkerVm } from "../../.pi/extensions/runtime/lib/env-worker-vm-boundary.mjs";
import { profileKey } from "../../.pi/extensions/runtime/lib/env-snapshot-cache.mjs";

function freshCacheRoot() {
  return mkdtempSync(join(tmpdir(), "env-worker-vm-boundary-"));
}

function fakeVmFactory(calls) {
  return async (args) => {
    calls.push(args);
    // A distinct object per call -- this is the "private VM" contract: no
    // acquisition may ever be handed a previously-returned instance.
    return { id: `vm-${calls.length}`, ...args };
  };
}

test("two workers on the same profile get two distinct private VMs, never a shared live instance", async () => {
  const root = freshCacheRoot();
  const provisionCalls = [];
  const vmCalls = [];
  const profile = { role: "developer", domain: "collaboration/github" };

  const provision = async (tempDir, forProfile) => {
    provisionCalls.push(forProfile);
    writeFileSync(join(tempDir, "guest.img"), "base+suite bytes");
  };

  const workerA = await acquireWorkerVm({ cacheRoot: root, profile, provision, vmFactory: fakeVmFactory(vmCalls) });
  const workerB = await acquireWorkerVm({ cacheRoot: root, profile, provision, vmFactory: fakeVmFactory(vmCalls) });

  assert.notEqual(workerA, workerB, "each acquisition must return a distinct VM object");
  assert.notEqual(workerA.id, workerB.id);
  assert.equal(provisionCalls.length, 1, "the same profile must only be provisioned once, ever");
  assert.equal(vmCalls.length, 2, "vmFactory must still be invoked fresh for every worker, hit or miss");

  rmSync(root, { recursive: true, force: true });
});

test("both private VMs boot from the same immutable backing snapshot (COW, not a shared writable one)", async () => {
  const root = freshCacheRoot();
  const vmCalls = [];
  const profile = { role: "developer" };
  const provision = async (tempDir) => writeFileSync(join(tempDir, "guest.img"), "base bytes");

  await acquireWorkerVm({ cacheRoot: root, profile, provision, vmFactory: fakeVmFactory(vmCalls) });
  await acquireWorkerVm({ cacheRoot: root, profile, provision, vmFactory: fakeVmFactory(vmCalls) });

  assert.equal(vmCalls.length, 2);
  assert.equal(
    vmCalls[0].sealedSnapshotPath,
    vmCalls[1].sealedSnapshotPath,
    "both workers must reference the exact same sealed backing artifact",
  );
  assert.ok(vmCalls[0].sealedSnapshotPath, "the backing path must actually be populated, not undefined");

  rmSync(root, { recursive: true, force: true });
});

test("distinct profiles are provisioned independently and never share a snapshot path", async () => {
  const root = freshCacheRoot();
  const vmCalls = [];
  const provisionedProfiles = [];
  const provision = async (tempDir, profile) => {
    provisionedProfiles.push(profile);
    writeFileSync(join(tempDir, "guest.img"), profile.role);
  };

  await acquireWorkerVm({
    cacheRoot: root,
    profile: { role: "developer" },
    provision,
    vmFactory: fakeVmFactory(vmCalls),
  });
  await acquireWorkerVm({
    cacheRoot: root,
    profile: { role: "reviewer" },
    provision,
    vmFactory: fakeVmFactory(vmCalls),
  });

  assert.equal(provisionedProfiles.length, 2, "distinct profiles must each provision their own snapshot");
  assert.notEqual(vmCalls[0].sealedSnapshotPath, vmCalls[1].sealedSnapshotPath);
  assert.notEqual(vmCalls[0].profileKey, vmCalls[1].profileKey);
  assert.equal(vmCalls[0].profileKey, profileKey({ role: "developer" }));

  rmSync(root, { recursive: true, force: true });
});

test("a provisioning failure surfaces to the caller instead of silently handing out a broken VM", async () => {
  const root = freshCacheRoot();
  const vmCalls = [];
  const profile = { role: "broken" };
  const provision = async () => {
    throw new Error("provisioning exploded");
  };

  await assert.rejects(
    acquireWorkerVm({ cacheRoot: root, profile, provision, vmFactory: fakeVmFactory(vmCalls) }),
    /provisioning exploded/,
  );
  assert.equal(vmCalls.length, 0, "vmFactory must never be called off a failed provision");

  rmSync(root, { recursive: true, force: true });
});
