import { fetchBaseAutomatonBody } from "./base-contract.mjs";
import { fetchPersona } from "./persona.mjs";
import { fetchCatalog } from "./catalog.mjs";
import { MODE_PROFILES } from "./modes.mjs";

export function resolveSpecialist(name, mode, task) {
  const profile = MODE_PROFILES[mode];
  if (!profile) {
    throw new Error(`Mode "${mode}" is not implemented — "doing" is pinned for a future saga.`);
  }

  const catalog = fetchCatalog(name);
  if (profile.requiresRole && !catalog.roles.includes(profile.requiresRole)) {
    throw new Error(`"${name}" has no "${profile.requiresRole}" role — not eligible for mode "${mode}".`);
  }

  const baseContract = fetchBaseAutomatonBody();
  const persona = fetchPersona(name);

  const instructions = [
    baseContract,
    "---\n# PERSONA",
    persona,
    "---\n# MODE",
    profile.modeDirective,
    "---\n# TASK CONTRACT",
    profile.overlay,
    "---\n# YOUR TASK",
    task,
  ].join("\n\n");

  return { instructions, tools: profile.tools };
}
