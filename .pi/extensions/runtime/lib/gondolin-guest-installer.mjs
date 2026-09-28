import path from "node:path";

const lockPath = (root) => path.posix.join(root, "package-lock.json");
const installedKey = (name) => `node_modules/${name}`;
const artifactDir = (root, sha256) => path.posix.join(root, "artifacts", sha256);

const readJson = async (guest, file) => JSON.parse(await guest.fs.readFile(file, { encoding: "utf8" }));
const tryRun = async (guest, argv) => {
  try {
    return (await guest.exec(argv)).exitCode === 0;
  } catch {
    return false;
  }
};
const requireRun = async (guest, argv, label) => {
  if (!(await tryRun(guest, argv))) throw new Error(`Guest ${label} failed`);
};

async function verifyLockIntegrity(guest, root, pkg) {
  const integrity = (await readJson(guest, lockPath(root)))?.packages?.[installedKey(pkg.name)]?.integrity;
  if (integrity !== pkg.integrity) throw new Error(`Guest package integrity mismatch: ${pkg.name}`);
}

// Installs exact npm package material entirely in the guest. npm validates
// downloaded bytes; the generated lockfile is then compared to Armory's
// independently pinned integrity before the package is trusted.
export async function installGuestPackage(guest, pkg, root = "/opt/hall/armory") {
  await requireRun(
    guest,
    ["/usr/bin/npm", "install", "--prefix", root, "--ignore-scripts", "--package-lock=true", `${pkg.name}@${pkg.version}`],
    "npm install",
  );
  await verifyLockIntegrity(guest, root, pkg);
}

function fallbackFor(native, platform) {
  const fallback = native.cacheFallback?.[platform];
  if (!fallback?.url || !fallback?.sha256 || fallback.archive?.format !== "tar.gz" || !fallback.archive.binary)
    throw new Error(`No verified guest fallback for ${native.command} on ${platform}`);
  return fallback;
}

// Native resolution is system-first. A fallback artifact is downloaded and
// verified in the guest only after the system probe fails.
export async function ensureGuestNative(guest, native, { platform, root = "/opt/hall/armory" }) {
  const probe = native.system?.probe ?? ["--version"];
  if (await tryRun(guest, ["/usr/bin/env", native.command, ...probe])) return { source: "system", command: native.command };

  const fallback = fallbackFor(native, platform);
  const directory = artifactDir(root, fallback.sha256);
  const archive = path.posix.join(directory, "payload.tar.gz");
  const checksum = path.posix.join(directory, "payload.sha256");
  const destination = path.posix.join(directory, "installed");
  if (!(await tryRun(guest, ["/bin/test", "-x", path.posix.join(destination, fallback.archive.binary)]))) {
    await requireRun(guest, ["/bin/mkdir", "-p", directory, destination], "artifact directory creation");
    await requireRun(guest, ["/usr/bin/curl", "--fail", "--location", "--output", archive, fallback.url], "native download");
    await guest.fs.writeFile(checksum, `${fallback.sha256}  ${archive}\n`, { encoding: "utf8" });
    await requireRun(guest, ["/usr/bin/sha256sum", "--check", checksum], "native checksum verification");
    await requireRun(guest, ["/bin/tar", "-xzf", archive, "--strip-components", String(fallback.archive.stripComponents ?? 0), "-C", destination], "native extraction");
  }
  const command = path.posix.join(destination, fallback.archive.binary);
  await requireRun(guest, [command, ...probe], "native fallback probe");
  return { source: "guest-cache", command, sha256: fallback.sha256 };
}
