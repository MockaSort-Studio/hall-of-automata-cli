import { readFileSync } from "node:fs";
import { BASE_GITHUB_TOOLS } from "./roster.mjs";

const ROOT = new URL("../", import.meta.url);
const CORE_PI_TOOLS = new Set(["read", "grep", "find", "ls", "bash", "edit", "write"]);

function roleCatalog() {
  return JSON.parse(readFileSync(new URL("prompts/roles.json", ROOT), "utf8"));
}

export function crewNativeToolNames(catalog = roleCatalog()) {
  const roleTools = Object.values(catalog).flatMap((role) => role.tools || []);
  return [...new Set([...BASE_GITHUB_TOOLS, ...roleTools])].filter((name) => !CORE_PI_TOOLS.has(name)).sort();
}

export function withCrewNativeToolVisibility(config = {}) {
  const capture = config.capture || {};
  return {
    ...config,
    capture: {
      ...capture,
      keepVisible: [...new Set([...(capture.keepVisible || []), ...crewNativeToolNames()])].sort(),
    },
  };
}
