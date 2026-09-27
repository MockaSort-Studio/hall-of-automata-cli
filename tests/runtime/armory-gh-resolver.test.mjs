import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ensureGhInGuest,
  execGhInGuest,
  guestPlatform,
  resolveVerifiedGh,
} from "../../.pi/extensions/runtime/lib/armory-gh.mjs";

// Pinned sha256 the resolver itself uses for this platform (see
// armory-gh.mjs's GH_MANIFEST); reused here only to compute the same cache
// path so a pre-seeded fake binary is found without a real network fetch.
const PINNED_SHA256_LINUX_ARM64 = "b57e8063f18862647c9d22727c32e9da1b963f8bf9db648fe123a6975695640f";
const cacheRoot = join(homedir(), ".cache", "hall", "armory");
const cleanupPaths = [];
const trackCache = () => cleanupPaths.push(cacheRoot);

test.after(() => {
  // Only remove digest-scoped subdirectories this suite itself created --
  // never blanket-delete a real user's Armory cache.
  for (const path of new Set(cleanupPaths)) rmSync(path, { recursive: true, force: true });
});

test("rejects a checksum mismatch before ever trusting or extracting the archive", async () => {
  const fakeFetch = async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode("not the real gh binary").buffer,
  });
  trackCache();
  await assert.rejects(resolveVerifiedGh("linux-arm64", fakeFetch), /Checksum mismatch/);
});

test("rejects an unknown guest platform before any network call", async () => {
  const fetchCalls = [];
  const fakeFetch = async (url) => {
    fetchCalls.push(url);
    throw new Error("must not be called");
  };
  await assert.rejects(resolveVerifiedGh("linux-riscv64", fakeFetch), /No Armory gh manifest/);
  assert.equal(fetchCalls.length, 0);
});

test("guestPlatform maps host architectures to the pinned manifest keys", () => {
  assert.equal(guestPlatform("arm64"), "linux-arm64");
  assert.equal(guestPlatform("x64"), "linux-amd64");
  assert.throws(() => guestPlatform("ia32"), /Unsupported host architecture/);
});

test("skips re-copying into the guest when the guest already reports the binary present", async () => {
  const calls = [];
  const fakeVm = {
    exec: async (argv) => {
      calls.push(argv);
      return { exitCode: 0, stdout: "", stderr: "" };
    },
    fs: { writeFile: async () => calls.push(["writeFile"]) },
  };
  const guestPath = await ensureGhInGuest(fakeVm, "/host/gh", "/opt/armory/gh");
  assert.equal(guestPath, "/opt/armory/gh");
  assert.deepEqual(calls, [["test", "-x", "/opt/armory/gh"]], "only the presence probe, no write or chmod");
});

test("execGhInGuest resolves from cache (no fetch needed), execs argv form, and surfaces a non-zero exit as an error", async () => {
  const cacheDir = join(cacheRoot, "linux-arm64", PINNED_SHA256_LINUX_ARM64);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, "gh"), "fake verified binary");
  trackCache();

  const execCalls = [];
  const fakeVm = {
    exec: async (argv) => {
      execCalls.push(argv);
      if (argv[0] === "test") return { exitCode: 1 }; // not yet in this guest
      if (argv[0] === "chmod") return { exitCode: 0 };
      return { exitCode: 7, stdout: "partial", stderr: "boom" };
    },
    fs: { writeFile: async () => execCalls.push(["writeFile"]) },
  };
  const unusedFetch = async () => {
    throw new Error("must not fetch: the cached binary should already satisfy resolveVerifiedGh");
  };

  await assert.rejects(execGhInGuest(fakeVm, ["--version"], unusedFetch), /gh exited with code 7/);
  assert.ok(
    execCalls.every((call) => Array.isArray(call)),
    "every guest interaction used argv/structured form, never a shell string",
  );
  assert.ok(
    execCalls.some((call) => call.includes("--version")),
    "the guest gh binary was actually invoked with the requested args",
  );
});
