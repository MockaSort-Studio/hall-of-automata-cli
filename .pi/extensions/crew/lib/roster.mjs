import { readFileSync } from "node:fs";
import { ARMORY } from "./armory.mjs";
const ROOT = new URL("../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("agents/agents.json", ROOT), "utf8"));
if (!catalog.automata || typeof catalog.automata !== "object")
  throw new Error("Roster must contain an automata object");
const NAME = /^[a-z][a-z0-9-]*$/;
for (const [name, automaton] of Object.entries(catalog.automata)) {
  if (!NAME.test(name) || !automaton || typeof automaton !== "object") throw new Error(`Invalid automaton: ${name}`);
  const p = automaton.persona;
  if (![p?.intro, p?.tone, p?.voice, p?.signature].every((value) => typeof value === "string" && value.trim()))
    throw new Error(`Invalid persona for automaton: ${name}`);
  if (p.intro.length > 320 || p.tone.length > 120 || p.voice.length > 240 || p.signature.length > 180)
    throw new Error(`Persona exceeds compact limits: ${name}`);
  if (
    !Array.isArray(automaton.domains) ||
    automaton.domains.length < 1 ||
    automaton.domains.length > 5 ||
    new Set(automaton.domains).size !== automaton.domains.length ||
    !automaton.domains.every((value) => /^[a-z0-9+][a-z0-9+-]*$/.test(value))
  )
    throw new Error(`Invalid routing for automaton: ${name}`);
  if (
    !Array.isArray(automaton.extensions) ||
    !automaton.extensions.every((value) => typeof value === "string") ||
    new Set(automaton.extensions).size !== automaton.extensions.length
  )
    throw new Error(`Invalid extensions for automaton: ${name}`);
  for (const extension of automaton.extensions)
    if (!Object.hasOwn(ARMORY, extension))
      throw new Error(`Unknown Armory extension for automaton: ${name}: ${extension}`);
}
export const AUTOMATA = Object.freeze(catalog.automata);
export const NAMES = Object.freeze(Object.keys(AUTOMATA));
export const BASE_GITHUB_TOOLS = Object.freeze([]);
export function getAutomaton(name) {
  const value = AUTOMATA[name];
  if (!value) throw new Error(`Unknown automaton "${name}". Available: ${NAMES.join(", ")}`);
  return { name, ...value };
}
export function listAutomata() {
  return NAMES.map(getAutomaton);
}
export function rankAutomata(text) {
  const haystack = String(text || "").toLowerCase();
  return listAutomata()
    .map((actor) => ({
      actor,
      score: actor.domains.filter((term) => haystack.includes(term.replaceAll("-", " ")) || haystack.includes(term))
        .length,
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.actor.name.localeCompare(b.actor.name));
}
