import { readFileSync } from "node:fs";

const STORE_PATH = /^\/nix\/store\/[a-z0-9]{32}-[^/]+$/;

// This is trusted worker-runtime configuration, not model tool data. It is
// deliberately limited to exact mount paths and operation grants; suite code,
// flake locators, credentials, and descriptors are not read here.
export function workerArmoryConfig(config) {
  const armory = config?.armory;
  if (!armory) return { paths: [], suites: [] };
  const paths = armory.nixPaths ?? [];
  const suites = armory.suites ?? [];
  if (!Array.isArray(paths) || new Set(paths).size !== paths.length || !paths.every((path) => STORE_PATH.test(path)))
    throw new Error("Worker Armory config has invalid Nix mount paths");
  if (
    !Array.isArray(suites) ||
    suites.some(
      (suite) => !paths.includes(suite.rootPath) || !Array.isArray(suite.tools) || suite.tools.some((tool) => typeof tool !== "string" || !tool),
    )
  )
    throw new Error("Worker Armory config has invalid suite operation grants");
  return { paths, suites: suites.map((suite) => ({ rootPath: suite.rootPath, tools: [...new Set(suite.tools)] })) };
}

export function readWorkerArmoryConfig(path = process.env.PI_CREW_WORKER_CONFIG) {
  if (!path) return { paths: [], suites: [] };
  return workerArmoryConfig(JSON.parse(readFileSync(path, "utf8")));
}
