import { fetchBaseAutomatonBody } from "./base-contract.mjs";
import { fetchPersona } from "./persona.mjs";
import { fetchCatalog } from "./catalog.mjs";
import { ROLE_DEFINITIONS } from "./roles.mjs";

export function installRole(
  name,
  role,
  task,
  override  // { model?, thinking? } — the lead's call when task complexity warrants it
) {
  const def = ROLE_DEFINITIONS[role];
  if (!def) {
    throw new Error(`Role "${role}" is not defined in this body.`);
  }

  const catalog = fetchCatalog(name);
  if (def.requiresCatalogRole && !catalog.roles.includes(def.requiresCatalogRole)) {
    throw new Error(
      `"${name}" has no "${def.requiresCatalogRole}" catalog role — not eligible for "${role}" role.`
    );
  }

  const baseContract = fetchBaseAutomatonBody();
  const persona = fetchPersona(name);

  const parts = [
    baseContract,
    "---\n# PERSONA",
    persona,
    "---\n# ROLE",
    def.discipline,
  ];

  if (def.methodology) {
    parts.push("---\n# METHODOLOGY", def.methodology);
  }

  parts.push("---\n# YOUR TASK", task);

  const instructions = parts.join("\n\n");

  return {
    instructions,
    tools: def.tools,
    model: override?.model ?? def.defaultModel,
    thinking: override?.thinking ?? def.defaultThinking,
  };
}
