import { existsSync, readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const CATALOG_FILE = new URL("agents/agents.json", ROOT);
const catalog = JSON.parse(readFileSync(CATALOG_FILE, "utf8"));
if (!catalog.automata || typeof catalog.automata !== "object") throw new Error("Roster must contain an automata object");

const NAME = /^[a-z][a-z0-9-]*$/;
for (const [name, automaton] of Object.entries(catalog.automata)) {
  if (!NAME.test(name) || !automaton || typeof automaton !== "object") throw new Error(`Invalid automaton: ${name}`);
  if (typeof automaton.persona !== "string" || !existsSync(new URL(automaton.persona, ROOT))) throw new Error(`Missing persona for automaton: ${name}`);
  if (!Array.isArray(automaton.domain) || !automaton.domain.every(value => typeof value === "string" && value)) throw new Error(`Invalid domain for automaton: ${name}`);
}
export const AUTOMATA = Object.freeze(catalog.automata);
export const NAMES = Object.freeze(Object.keys(AUTOMATA));
export const BASE_GITHUB_TOOLS = Object.freeze(["github_issues_list", "github_issue_view", "github_dependency_list", "github_subissues_list", "github_label_list", "github_project_fields", "github_project_item_find", "github_pull_requests_list", "github_pull_request_view", "github_discussion_comments", "github_discussion_view"]);
export function getAutomaton(name) { const value = AUTOMATA[name]; if (!value) throw new Error(`Unknown automaton "${name}". Available: ${NAMES.join(", ")}`); return { name, ...value }; }
export function listAutomata() { return NAMES.map(getAutomaton); }
