import { fetchPersona } from "../persona.mjs";
export function personaModule(ctx) {
  return { instructions: fetchPersona(ctx.name), tools: [] };
}