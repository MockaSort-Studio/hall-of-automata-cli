import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  cachePathFor,
  createTempDirectoryTarget,
  fetchVerifiedArtifact,
  materializeIntoTarget,
  pathExists,
  publishAtomically,
  resolveVerifiedArtifact,
  verifyChecksum,
} from "../../.pi/extensions/hall-crew/env-runtime/lib/armory-core.mjs";

const sha256Hex = (text) => createHash("sha256").update(text).digest("hex");

const tempRoots = [];
async function freshTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "armory-core-test-"));
  tempRoots.push(root);
  return root;
}
test.after(async () => {
  for (const root of tempRoots) await rm(root, { recursive: true, force: true });
});

test("verifyChecksum rejects a mismatched digest and accepts a matching one", () => {
  const bytes = Buffer.from("artifact bytes");
  assert.throws(() => verifyChecksum(bytes, "0".repeat(64)), /Checksum mismatch/);
  assert.equal(verifyChecksum(bytes, sha256Hex(bytes)), sha256Hex(bytes));
});

test("fetchVerifiedArtifact rejects a checksum mismatch and never returns unverified bytes", async () => {
  const fakeFetch = async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode("wrong bytes").buffer,
  });
  await assert.rejects(
    fetchVerifiedArtifact("https://example.invalid/artifact", sha256Hex("expected bytes"), fakeFetch),
    /Checksum mismatch/,
  );
});

test("resolveVerifiedArtifact materializes into a plain temp-directory cache and reuses it without a second fetch", async () => {
  const root = await freshTempRoot();
  const payload = "verified plain-directory artifact";
  const manifest = { url: "https://example.invalid/artifact", sha256: sha256Hex(payload) };
  const cacheDir = cachePathFor(root, "host-platform", manifest.sha256);
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(payload).buffer };
  };
  const extract = async (bytes, stagingDir) => {
    await mkdir(stagingDir, { recursive: true });
    await writeFile(join(stagingDir, "payload.bin"), bytes);
  };
  const locate = (destDir) => join(destDir, "payload.bin");

  const first = await resolveVerifiedArtifact({ manifest, cacheDir, fetchImpl, extract, locate });
  assert.equal((await readFile(first, "utf8")), payload);
  assert.equal(fetchCalls, 1);

  const second = await resolveVerifiedArtifact({ manifest, cacheDir, fetchImpl, extract, locate });
  assert.equal(second, first);
  assert.equal(fetchCalls, 1, "second resolve reused the published cache entry instead of re-fetching");
});

test("resolveVerifiedArtifact rejects a checksum mismatch and leaves no cache entry behind", async () => {
  const root = await freshTempRoot();
  const manifest = { url: "https://example.invalid/artifact", sha256: sha256Hex("expected bytes") };
  const cacheDir = cachePathFor(root, "host-platform", manifest.sha256);
  const fetchImpl = async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode("tampered bytes").buffer,
  });
  const extract = async () => assert.fail("extract must not run before the checksum is verified");
  const locate = () => assert.fail("locate must not run when publication never happened");

  await assert.rejects(
    resolveVerifiedArtifact({ manifest, cacheDir, fetchImpl, extract, locate }),
    /Checksum mismatch/,
  );
  assert.equal(await pathExists(cacheDir), false, "a failed resolve must not publish a cache entry");
});

test("publishAtomically never exposes a partially-produced directory at the final path", async () => {
  const root = await freshTempRoot();
  const finalDir = join(root, "cache-entry");

  await assert.rejects(
    publishAtomically(finalDir, async (stagingDir) => {
      await writeFile(join(stagingDir, "partial"), "incomplete");
      throw new Error("boom mid-publish");
    }),
    /boom mid-publish/,
  );

  assert.equal(await pathExists(finalDir), false, "final path must stay absent after a failed publish");
  const siblings = await readdir(root);
  assert.deepEqual(siblings, [], "no leftover staging directory after a failed publish");
});

test("publishAtomically treats an existing final directory as complete and skips produce", async () => {
  const root = await freshTempRoot();
  const finalDir = join(root, "cache-entry");
  await mkdir(finalDir, { recursive: true });
  await writeFile(join(finalDir, "marker"), "already published");

  const result = await publishAtomically(finalDir, async () => {
    assert.fail("produce must not run when the final directory already exists");
  });

  assert.equal(result, finalDir);
});

test("materializeIntoTarget writes into a plain temp-directory target once, then skips a repeat write", async () => {
  const root = await freshTempRoot();
  const target = createTempDirectoryTarget(root);
  let reads = 0;
  const readBytes = async () => {
    reads += 1;
    return Buffer.from("#!/bin/sh\necho tool\n");
  };

  const first = await materializeIntoTarget(target, "bin/tool", readBytes);
  assert.equal(first, "bin/tool");
  const fullPath = join(root, "bin", "tool");
  const mode = (await stat(fullPath)).mode;
  assert.ok(mode & 0o100, "materialized file must be executable");
  assert.equal(reads, 1);

  await materializeIntoTarget(target, "bin/tool", readBytes);
  assert.equal(reads, 1, "second materialize call must not re-read bytes for an already-present executable");
});
