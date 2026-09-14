import { readFileSync } from "node:fs";
const ROOT = new URL("../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("agents/agents.json", ROOT), "utf8"));
if (!catalog.automata || typeof catalog.automata !== "object") throw new Error("Roster must contain an automata object");
const NAME = /^[a-z][a-z0-9-]*$/;
for (const [name, automaton] of Object.entries(catalog.automata)) {
  if (!NAME.test(name) || !automaton || typeof automaton !== "object") throw new Error(`Invalid automaton: ${name}`);
  const p = automaton.persona;
  if (![p?.intro,p?.tone,p?.voice,p?.signature].every(value => typeof value === "string" && value.trim())) throw new Error(`Invalid persona for automaton: ${name}`);
  if (p.intro.length > 320 || p.tone.length > 120 || p.voice.length > 240 || p.signature.length > 180) throw new Error(`Persona exceeds compact limits: ${name}`);
  if (!Array.isArray(automaton.routing) || automaton.routing.length < 1 || automaton.routing.length > 5 || new Set(automaton.routing).size !== automaton.routing.length || !automaton.routing.every(value => /^[a-z0-9+][a-z0-9+-]*$/.test(value))) throw new Error(`Invalid routing for automaton: ${name}`);
  if (!Array.isArray(automaton.extensions) || !automaton.extensions.every(value => typeof value === "string")) throw new Error(`Invalid extensions for automaton: ${name}`);
}
export const AUTOMATA = Object.freeze(catalog.automata); export const NAMES = Object.freeze(Object.keys(AUTOMATA));
export const BASE_GITHUB_TOOLS = Object.freeze(["github_issues_list","github_issue_view","github_dependency_list","github_subissues_list","github_label_list","github_project_fields","github_project_item_find","github_pull_requests_list","github_pull_request_view","github_discussion_comments","github_discussion_view"]);
export function getAutomaton(name) { const value = AUTOMATA[name]; if (!value) throw new Error(`Unknown automaton "${name}". Available: ${NAMES.join(", ")}`); return { name, ...value }; }
export function listAutomata() { return NAMES.map(getAutomaton); }
