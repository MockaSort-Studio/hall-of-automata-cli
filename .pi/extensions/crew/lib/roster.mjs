import { existsSync, readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const CATALOG_FILE = new URL("agents/agents.json", ROOT);
const SOUL_DIR = new URL("roster/", ROOT);
const catalog = JSON.parse(readFileSync(CATALOG_FILE, "utf8"));

if (!catalog.automata || typeof catalog.automata !== "object") {
  throw new Error("Roster must contain an automata object");
}

const NAME = /^[a-z][a-z0-9-]*$/;
for (const [name, automaton] of Object.entries(catalog.automata)) {
  if (!NAME.test(name)) throw new Error(`Invalid automaton name: ${name}`);
  if (!automaton || typeof automaton !== "object") throw new Error(`Invalid automaton: ${name}`);
  if (!Array.isArray(automaton.domains) || !automaton.domains.every(d => typeof d === "string")) {
    throw new Error(`Invalid domains for automaton: ${name}`);
  }
  if (!Array.isArray(automaton.allowed_tools) || !automaton.allowed_tools.every(t => typeof t === "string")) {
    throw new Error(`Invalid allowed_tools for automaton: ${name}`);
  }
  if (!existsSync(new URL(`${name}.md`, SOUL_DIR))) throw new Error(`Missing soul for automaton: ${name}`);
}

export const AUTOMATA = Object.freeze(catalog.automata);
export const NAMES = Object.freeze(Object.keys(AUTOMATA));

export const BASE_GITHUB_TOOLS = Object.freeze([
  "github_issues_list", "github_issue_view", "github_issue_comment", "github_issue_update",
  "github_dependency_list", "github_subissues_list", "github_label_list",
  "github_issue_add_label", "github_issue_remove_label", "github_project_fields",
  "github_project_item_add", "github_project_item_find", "github_project_field_set",
  "github_pull_requests_list", "github_pull_request_view", "github_pull_request_comment",
  "github_pull_request_update", "github_pull_request_review", "github_pull_request_merge",
  "github_pull_request_add_label", "github_pull_request_remove_label",
]);

export function getAutomaton(name) {
  const value = AUTOMATA[name];
  if (!value) throw new Error(`Unknown automaton "${name}". Available: ${NAMES.join(", ")}`);
  return { name, ...value };
}

export function listAutomata() {
  return NAMES.map(getAutomaton);
}
