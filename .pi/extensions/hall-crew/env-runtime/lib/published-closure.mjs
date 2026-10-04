import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { nixBinary } from "./nix-binary.mjs";

const exec = promisify(execFile);

// Fetches a published closure by store path: no flake evaluation, and `nix copy`
// asks the cache directly, so it is unaffected by the daemon's cached misses.
// Nix verifies signatures; this also checks the installed closure against the
// hashes the catalog promised before rooting it.
export async function fetchPublishedClosure({ artifact, cache, gcRoot, execute = exec }) {
  const nix = nixBinary();
  await execute(nix, ["copy", "--from", cache.substituter, artifact.storePath]);
  const { stdout } = await execute(nix, ["path-info", "-r", "--json", "--json-format", "1", artifact.storePath]);
  const installed = JSON.parse(stdout);
  const expected = artifact.closure.map((item) => item.path).sort();
  if (JSON.stringify(Object.keys(installed).sort()) !== JSON.stringify(expected))
    throw new Error("Installed closure differs from the published Armory catalog");
  const changed = artifact.closure.find((item) => installed[item.path]?.narHash !== item.narHash);
  if (changed) throw new Error(`Content of ${changed.path} differs from the published Armory catalog`);
  await mkdir(dirname(gcRoot), { recursive: true });
  await execute(nix, ["build", "--out-link", gcRoot, "--print-out-paths", artifact.storePath]);
  return { rootPath: artifact.storePath, paths: expected };
}
