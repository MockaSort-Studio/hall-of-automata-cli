import { execFile } from "node:child_process";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
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

// Builds only the suite's locked default Nix output. Nix verifies its configured
// binary caches; Env later mounts the resulting local store paths read-only.
export async function buildNixClosure({ suiteRoot, closure, execute = exec }) {
  const directory = closureDirectory(suiteRoot, closure);
  const flake = `path:${directory}`;
  const { stdout: buildOutput } = await execute("nix", ["build", "--no-link", "--print-out-paths", `${flake}#default`]);
  const rootPath = buildOutput.trim();
  if (!STORE_PATH.test(rootPath)) throw new Error("Nix closure build did not return one store path");
  const { stdout: pathInfo } = await execute("nix", [
    "path-info",
    "--recursive",
    "--json",
    "--json-format",
    "1",
    rootPath,
  ]);
  const paths = closurePaths(pathInfo);
  if (!paths.includes(rootPath)) throw new Error("Nix closure omits its built root path");
  return { rootPath, paths, closureDirectory: directory };
}
