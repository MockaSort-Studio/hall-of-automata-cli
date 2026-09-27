import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir, arch as hostArch } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  cachePathFor,
  createGuestExecTarget,
  fetchVerifiedArtifact,
  materializeIntoTarget,
  pathExists,
  publishAtomically,
} from "./armory-core.mjs";

const exec = promisify(execFile);
const GH_VERSION = "2.101.0";
const GUEST_PATH = join("/", "opt", "armory", "gh");
// Pinned against GitHub's own published release checksums (v2.101.0), not
// invented: https://github.com/cli/cli/releases/download/v2.101.0/gh_2.101.0_checksums.txt
const GH_MANIFEST = {
  "linux-arm64": {
    url: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_arm64.tar.gz`,
    sha256: "b57e8063f18862647c9d22727c32e9da1b963f8bf9db648fe123a6975695640f",
  },
  "linux-amd64": {
    url: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz`,
    sha256: "9bca2d1c16825f109907a23307628a2f0698fbf99662b73a5cf0b020293072b8",
  },
};

export function guestPlatform(architecture = hostArch()) {
  if (architecture === "arm64") return "linux-arm64";
  if (architecture === "x64") return "linux-amd64";
  throw new Error(`Unsupported host architecture for Armory gh: ${architecture}`);
}

const armoryCacheRoot = () => join(homedir(), ".cache", "hall", "armory");

async function extractGhTarball(tarballBytes, stagingDir) {
  await mkdir(stagingDir, { recursive: true });
  const tarballPath = join(stagingDir, "gh.tar.gz");
  await writeFile(tarballPath, tarballBytes);
  await exec("tar", ["-xzf", tarballPath, "-C", stagingDir]);
}

async function locateGhBinary(destDir) {
  const entries = await readdir(destDir);
  const versionDir = entries.find((entry) => entry.startsWith("gh_"));
  if (!versionDir) throw new Error("Armory gh: extracted tarball did not contain a gh_<version> directory");
  return join(destDir, versionDir, "bin", "gh");
}

/**
 * Resolve a verified `gh` binary path in the local Armory cache for the given
 * guest platform, downloading and checksum-verifying it first if this exact
 * digest is not already cached. Never trusts an archive before its sha256
 * matches the pinned manifest. Extraction is published atomically (see
 * `armory-core.mjs`'s `publishAtomically`), so a concurrent resolver never
 * observes a half-extracted cache entry.
 */
export async function resolveVerifiedGh(platform = guestPlatform(), fetchImpl = fetch) {
  const manifest = GH_MANIFEST[platform];
  if (!manifest) throw new Error(`No Armory gh manifest for platform ${platform}`);
  const cacheDir = cachePathFor(armoryCacheRoot(), platform, manifest.sha256);
  const cachedBinary = join(cacheDir, "gh");
  if (await pathExists(cachedBinary)) return cachedBinary;
  await publishAtomically(cacheDir, async (stagingDir) => {
    const tarballBytes = await fetchVerifiedArtifact(manifest.url, manifest.sha256, fetchImpl);
    await extractGhTarball(tarballBytes, stagingDir);
  });
  return locateGhBinary(cacheDir);
}

/**
 * Copy the verified host-cached `gh` binary into the guest at a stable path,
 * skipping the copy if this VM instance already has it. Never executes `gh`
 * on the host -- only writes its verified bytes into the guest filesystem.
 */
export async function ensureGhInGuest(vm, hostGhPath, guestPath = GUEST_PATH) {
  const target = createGuestExecTarget(vm);
  return materializeIntoTarget(target, guestPath, () => readFile(hostGhPath));
}

/**
 * Execute `gh` inside the given Gondolin guest, resolving and verifying the
 * pinned binary first if needed. Argv form only (`vm.exec([path, ...args])`),
 * never a shell string, so args are never shell-interpreted.
 */
export async function execGhInGuest(vm, args, fetchImpl = fetch) {
  const hostGhPath = await resolveVerifiedGh(undefined, fetchImpl);
  const guestPath = await ensureGhInGuest(vm, hostGhPath);
  const result = await vm.exec([guestPath, ...args]);
  if (result.exitCode !== 0) {
    const error = new Error(`gh exited with code ${result.exitCode}`);
    error.status = result.exitCode;
    error.stderr = result.stderr;
    error.stdout = result.stdout;
    throw error;
  }
  return (result.stdout ?? "").trim();
}
