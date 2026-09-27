import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  lookupSealedSnapshot,
  profileKey,
  publishSealedSnapshot,
  readSealedMetadata,
} from "../../.pi/extensions/runtime/lib/env-snapshot-cache.mjs";

function freshCacheRoot() {
  const root = mkdtempSync(join(tmpdir(), "env-snapshot-cache-"));
  return root;
}

test("profileKey is stable across key order and sensitive to real content changes", () => {
  const a = profileKey({ role: "developer", domain: "collaboration/github", operations: ["issue", "pull"] });
  const b = profileKey({ operations: ["issue", "pull"], domain: "collaboration/github", role: "developer" });
  const c = profileKey({ role: "developer", domain: "collaboration/github", operations: ["issue"] });
  assert.equal(a, b, "key order must not change identity");
  assert.notEqual(a, c, "a real profile difference must change identity");
});

test("lookupSealedSnapshot misses on an empty cache and on a partially-written entry", () => {
  const root = freshCacheRoot();
  const key = profileKey({ role: "tester" });
  assert.equal(lookupSealedSnapshot(root, key), undefined);

  // Simulate a torn/partial publish: content present, no sealed marker.
  const dir = join(root, key);
  writeFileSync(join(root, key + ".partial"), "not a real entry, no marker");
  assert.equal(lookupSealedSnapshot(root, key), undefined);

  rmSync(root, { recursive: true, force: true });
  void dir;
});

test("publishSealedSnapshot seals content once and reports it as a hit afterward", async () => {
  const root = freshCacheRoot();
  const key = profileKey({ role: "tester" });
  let populateCalls = 0;

  const dir = await publishSealedSnapshot(root, key, async (tempDir) => {
    populateCalls++;
    writeFileSync(join(tempDir, "payload.txt"), "sealed content v1");
  });

  assert.equal(populateCalls, 1);
  assert.equal(readFileSync(join(dir, "payload.txt"), "utf8"), "sealed content v1");
  assert.equal(lookupSealedSnapshot(root, key), dir, "a sealed entry must be visible to lookup afterward");
  assert.equal(readSealedMetadata(dir).key, key);

  rmSync(root, { recursive: true, force: true });
});

test("publication is immutable: a second publish for the same key never rebuilds or overwrites", async () => {
  const root = freshCacheRoot();
  const key = profileKey({ role: "tester" });

  const first = await publishSealedSnapshot(root, key, async (tempDir) => {
    writeFileSync(join(tempDir, "payload.txt"), "sealed content v1");
  });

  let secondPopulateCalls = 0;
  const second = await publishSealedSnapshot(root, key, async (tempDir) => {
    secondPopulateCalls++;
    writeFileSync(join(tempDir, "payload.txt"), "sealed content v2 -- must never win");
  });

  assert.equal(second, first, "the same key must resolve to the same sealed entry");
  assert.equal(secondPopulateCalls, 0, "a second publish for an already-sealed key must not rebuild");
  assert.equal(
    readFileSync(join(first, "payload.txt"), "utf8"),
    "sealed content v1",
    "sealed content must never be replaced by a later publish attempt",
  );

  rmSync(root, { recursive: true, force: true });
});

test("a failed populate leaves no partial entry behind, so a later publish can still succeed", async () => {
  const root = freshCacheRoot();
  const key = profileKey({ role: "tester" });

  await assert.rejects(
    publishSealedSnapshot(root, key, async () => {
      throw new Error("boom during provisioning");
    }),
    /boom during provisioning/,
  );
  assert.equal(lookupSealedSnapshot(root, key), undefined, "a failed publish must not seal a broken entry");

  const dir = await publishSealedSnapshot(root, key, async (tempDir) => {
    writeFileSync(join(tempDir, "payload.txt"), "sealed content after retry");
  });
  assert.equal(readFileSync(join(dir, "payload.txt"), "utf8"), "sealed content after retry");

  rmSync(root, { recursive: true, force: true });
});

test("different profiles never collide on the same cache entry", async () => {
  const root = freshCacheRoot();
  const keyA = profileKey({ role: "developer" });
  const keyB = profileKey({ role: "reviewer" });

  const dirA = await publishSealedSnapshot(root, keyA, async (tempDir) => writeFileSync(join(tempDir, "who"), "A"));
  const dirB = await publishSealedSnapshot(root, keyB, async (tempDir) => writeFileSync(join(tempDir, "who"), "B"));

  assert.notEqual(dirA, dirB);
  assert.equal(readFileSync(join(dirA, "who"), "utf8"), "A");
  assert.equal(readFileSync(join(dirB, "who"), "utf8"), "B");

  rmSync(root, { recursive: true, force: true });
});
