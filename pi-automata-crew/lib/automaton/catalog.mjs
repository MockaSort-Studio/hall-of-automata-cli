import { gh } from "../../pi-git-extension/lib/gh.mjs";

// Capability signal only — eligibility gate, never widens a tool grant.
export function fetchCatalog(name) {
  const raw = gh([
    "api", "repos/MockaSort-Studio/hall-of-automata/contents/agents.json",
    "--jq", ".content",
  ]);
  const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  const entry = json.agents[name];
  if (!entry) throw new Error(`No agents.json entry for "${name}"`);
  return entry.catalog;
}
