import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { publishAtomically } from "./armory-core.mjs";

const exec = promisify(execFile);

const packageKey = (integrity) => createHash("sha256").update(integrity).digest("hex");
const packageRoot = (cacheDir, name) => join(cacheDir, "node_modules", name);

async function readLock(cacheDir) {
  try {
    return JSON.parse(await readFile(join(cacheDir, "package-lock.json"), "utf8"));
  } catch {
    return undefined;
  }
}

async function verifiedPackage(cacheDir, pkg) {
  const lock = await readLock(cacheDir);
  const integrity = lock?.packages?.[`node_modules/${pkg.name}`]?.integrity;
  try {
    await access(join(packageRoot(cacheDir, pkg.name), "package.json"));
  } catch {
    return undefined;
  }
  return integrity === pkg.integrity ? packageRoot(cacheDir, pkg.name) : undefined;
}

async function npmInstall(directory, pkg, execute = exec) {
  await execute("npm", [
    "install",
    "--prefix",
    directory,
    "--ignore-scripts",
    "--package-lock=true",
    "--no-save",
    `${pkg.name}@${pkg.version}`,
  ]);
}

// Npm is only a source/package cache here. Native executables are built by
// Nix and run only through Env's guest binding.
export async function acquireArmoryPackage({ cacheRoot, package: pkg, install = npmInstall }) {
  if (!pkg?.name || !pkg?.version || !pkg?.integrity) throw new Error("Armory package identity is incomplete");
  const cacheDir = join(cacheRoot, packageKey(pkg.integrity));
  const cached = await verifiedPackage(cacheDir, pkg);
  if (cached) return cached;
  await publishAtomically(cacheDir, async (stagingDir) => {
    await install(stagingDir, pkg);
    if (!(await verifiedPackage(stagingDir, pkg))) throw new Error(`Armory package integrity mismatch: ${pkg.name}`);
  });
  const installed = await verifiedPackage(cacheDir, pkg);
  if (!installed) throw new Error(`Armory package cache is invalid: ${pkg.name}`);
  return installed;
}
