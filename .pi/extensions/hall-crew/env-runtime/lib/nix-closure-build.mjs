import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { nixBinary } from "./nix-binary.mjs";

const exec = promisify(execFile);

// The guest is a Linux VM of the host's architecture, so a flake output must
// be selected for that system even when the host itself is macOS.
export const guestNixSystem = (arch = process.arch) => (arch === "arm64" ? "aarch64-linux" : "x86_64-linux");
const STORE_PATH = /^\/nix\/store\/[a-z0-9]{32}-[^/]+$/;

function closureDirectory(suiteRoot, closure) {
  if (typeof closure !== "string" || !closure.trim()) throw new Error("Nix closure path is required");
  const root = resolve(suiteRoot);
  const directory = resolve(root, closure);
  if (directory !== root && !directory.startsWith(`${root}${sep}`)) throw new Error("Nix closure path escapes suite root");
  return directory;
}

function closurePaths(output) {
  const paths = Object.keys(JSON.parse(output)).sort();
  if (!paths.length || !paths.every((path) => STORE_PATH.test(path))) throw new Error("Nix returned invalid closure paths");
  return paths;
}

// Builds one locked Nix suite output. Nix verifies configured binary caches;
// Env later mounts the resulting local store paths read-only.
export async function buildNixClosure({ suiteRoot, closure, output = "default", flake, gcRoot, execute = exec }) {
  if (typeof output !== "string" || !output || /\s/.test(output)) throw new Error("Nix suite output is required");
  if (gcRoot) await mkdir(dirname(gcRoot), { recursive: true });
  const directory = flake ? undefined : closureDirectory(suiteRoot, closure);
  const locator = flake ?? `path:${directory}`;
  const attribute = flake ? `packages.${guestNixSystem()}.${output}` : output;
  if (typeof locator !== "string" || !locator || /\s/.test(locator)) throw new Error("Nix suite flake locator is required");
  const { stdout: buildOutput } = await execute(nixBinary(), [
    "build",
    ...(gcRoot ? ["--out-link", gcRoot] : ["--no-link"]),
    "--print-out-paths",
    `${locator}#${attribute}`,
  ]);
  const rootPath = buildOutput.trim();
  if (!STORE_PATH.test(rootPath)) throw new Error("Nix closure build did not return one store path");
  const { stdout: pathInfo } = await execute(nixBinary(), [
    "path-info",
    "--recursive",
    "--json",
    "--json-format",
    "1",
    rootPath,
  ]);
  const paths = closurePaths(pathInfo);
  if (!paths.includes(rootPath)) throw new Error("Nix closure omits its built root path");
  return { rootPath, paths, closureDirectory: directory, flake: locator, output };
}
