import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { promisify } from "node:util";
import { nixBinary } from "./nix-binary.mjs";

const exec = promisify(execFile);
const REVISION = /^[0-9a-f]{40}$/;
const relativePath = (value, label) => {
  if (typeof value !== "string" || !value || value.startsWith("/") || value.split("/").includes(".."))
    throw new Error(`Armory ${label} must be a non-escaping relative path`);
  return value;
};

function lockedGithub(metadata) {
  const locked = metadata?.locked;
  if (locked?.type !== "github" || typeof locked.owner !== "string" || typeof locked.repo !== "string" || !REVISION.test(locked.rev))
    throw new Error("Armory catalog must resolve to an immutable GitHub revision");
  if (typeof metadata.path !== "string" || !metadata.path.startsWith("/nix/store/"))
    throw new Error("Nix did not materialize the Armory catalog source");
  return locked;
}

async function jsonFile(path, read) {
  try {
    return JSON.parse(await read(path, "utf8"));
  } catch {
    throw new Error(`Armory catalog source is not JSON: ${path}`);
  }
}

// Resolve a mutable discovery channel once. Every returned locator contains the
// immutable revision Nix actually fetched, and all subsequent suite reads and
// Nix builds must use that locator rather than the original channel.
export async function resolveArmoryCatalogReference({
  flake = "github:MockaSort-Studio/hall-armory/main",
  manifest = "manifest.json",
  execute = exec,
  read = readFile,
} = {}) {
  const catalogManifest = relativePath(manifest, "catalog manifest path");
  // Lazy trees (Determinate Nix) leave the source virtual; the catalog and suite
  // manifests are read from a real store path, so materialize it.
  const { stdout } = await execute(nixBinary(), [
    "flake",
    "metadata",
    "--refresh",
    "--json",
    "--option",
    "lazy-trees",
    "false",
    flake,
  ]);
  const metadata = JSON.parse(stdout);
  const locked = lockedGithub(metadata);
  return {
    flake: `github:${locked.owner}/${locked.repo}/${locked.rev}`,
    revision: locked.rev,
    sourcePath: metadata.path,
    manifest: catalogManifest,
    catalog: await jsonFile(join(metadata.path, catalogManifest), read),
  };
}

export async function readCatalogSuite(reference, manifestPath, { read = readFile } = {}) {
  const path = relativePath(manifestPath, "suite manifest path");
  return jsonFile(join(reference.sourcePath, path), read);
}

export function suiteFlakeLocator(reference, manifestPath, native) {
  const manifest = relativePath(manifestPath, "suite manifest path");
  const closure = relativePath(native?.closure, "suite closure path");
  if (typeof native?.output !== "string" || !native.output) throw new Error("Armory suite Nix output is required");
  const directory = posix.normalize(posix.join(posix.dirname(manifest), closure));
  return `${reference.flake}?dir=${directory}#${native.output}`;
}
