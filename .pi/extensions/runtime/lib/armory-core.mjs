// Env-agnostic Armory primitives: checksum verification, verified download,
// content-addressed cache publication, and materialization into an abstract
// filesystem target. No MicroVM/Gondolin import and no lifecycle assumption
// lives here -- a "target" is any object shaped like { hasExecutable,
// writeExecutable }, and a cache root is just a directory on disk. Tool-
// specific adapters (for example `armory-gh.mjs`) compose these primitives
// with their own manifest, extraction, and target wiring.
import { createHash } from "node:crypto";
import { access, chmod, constants as fsConstants, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Compute and verify a sha256 digest, throwing before any bytes are trusted. */
export function verifyChecksum(bytes, expectedSha256) {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expectedSha256) throw new Error(`Checksum mismatch: expected ${expectedSha256}, got ${actual}`);
  return actual;
}

/**
 * Download one artifact and verify its bytes against a pinned sha256 before
 * returning them. Never returns unverified bytes to a caller.
 */
export async function fetchVerifiedArtifact(url, expectedSha256, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Armory download failed: ${response.status} ${response.statusText} (${url})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyChecksum(bytes, expectedSha256);
  return bytes;
}

export const pathExists = (path) =>
  access(path)
    .then(() => true)
    .catch(() => false);

/** Build a content-addressed cache directory path: `<root>/<platform>/<digest>`. */
export function cachePathFor(cacheRoot, platform, digest) {
  return join(cacheRoot, platform, digest);
}

/**
 * Publish the result of `produce(stagingDir)` at `finalDir` atomically: build
 * into a sibling temp directory first, then rename into place. A concurrent
 * reader of `finalDir` never observes a partially-written directory, and a
 * reader that arrives after a failed `produce` finds nothing at `finalDir`
 * (not a half-extracted entry). If `finalDir` already exists, `produce` is
 * skipped entirely -- existence at `finalDir` is itself the completeness
 * signal, because nothing reaches that path except a successful rename.
 */
export async function publishAtomically(finalDir, produce) {
  if (await pathExists(finalDir)) return finalDir;
  const parent = join(finalDir, "..");
  await mkdir(parent, { recursive: true });
  const stagingDir = await mkdtemp(join(parent, ".armory-staging-"));
  try {
    await produce(stagingDir);
    await rename(stagingDir, finalDir);
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    if (error?.code === "ENOTEMPTY" || error?.code === "EEXIST") {
      if (await pathExists(finalDir)) return finalDir;
    }
    throw error;
  }
  return finalDir;
}

/**
 * Ensure `path` is present and executable in `target`, materializing bytes
 * from `readBytes()` only when the target does not already report it
 * present. `readBytes` is a thunk so a cached-in-target hit never touches
 * the host filesystem it would otherwise read from.
 */
export async function materializeIntoTarget(target, path, readBytes) {
  if (await target.hasExecutable(path)) return path;
  const bytes = await readBytes();
  await target.writeExecutable(path, bytes);
  return path;
}

/**
 * A plain-directory filesystem target: no VM, no guest, no lifecycle --
 * just a directory on the same host. Used for tests and for any Armory
 * consumer whose target is a real directory rather than a sandboxed guest.
 */
export function createTempDirectoryTarget(rootDir) {
  const resolve = (path) => join(rootDir, path);
  return {
    async hasExecutable(path) {
      try {
        await access(resolve(path), fsConstants.X_OK);
        return true;
      } catch {
        return false;
      }
    },
    async writeExecutable(path, bytes) {
      const fullPath = resolve(path);
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, bytes, { mode: 0o755 });
      await chmod(fullPath, 0o755);
    },
  };
}

/**
 * A guest filesystem target for any executor shaped like `{ exec(argv),
 * fs: { writeFile(path, bytes, opts) } }` (a Gondolin VM satisfies this
 * shape today, but this module never imports or assumes one). Presence is
 * probed and permissions are set with argv-only guest commands, never a
 * shell string.
 */
export function createGuestExecTarget(guest) {
  return {
    async hasExecutable(path) {
      const probe = await guest.exec(["test", "-x", path]).catch(() => ({ exitCode: 1 }));
      return probe.exitCode === 0;
    },
    async writeExecutable(path, bytes) {
      await guest.fs.writeFile(path, bytes, { mode: 0o755 });
      await guest.exec(["chmod", "+x", path]);
    },
  };
}

/**
 * Resolve a verified artifact into a digest-keyed cache directory,
 * downloading and extracting it only on a cache miss. `extract(bytes,
 * stagingDir)` writes/unpacks into a staging directory; `locate(cacheDir)`
 * derives the final artifact path from a directory that is either freshly
 * published or was already complete. Extraction is atomic (see
 * `publishAtomically`): a concurrent resolver for the same digest never
 * observes a half-extracted cache entry.
 */
export async function resolveVerifiedArtifact({ manifest, cacheDir, fetchImpl = fetch, extract, locate }) {
  await publishAtomically(cacheDir, async (stagingDir) => {
    const bytes = await fetchVerifiedArtifact(manifest.url, manifest.sha256, fetchImpl);
    await extract(bytes, stagingDir);
  });
  return locate(cacheDir);
}
