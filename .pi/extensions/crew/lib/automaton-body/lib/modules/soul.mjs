import { fetchPersona } from "../persona.mjs";

// Soul module: pure character narrative from roster/<name>.md
// Live-fetched, never cached - same discipline as all Hall state
// This IS the persona, renamed to match Specialist 2.0 terminology

export function soulModule(ctx) {
  if (!ctx.name) throw new Error("soulModule requires ctx.name");
  return {
    instructions: fetchPersona(ctx.name),
    tools: []
  };
}
