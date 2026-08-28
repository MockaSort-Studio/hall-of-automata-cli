import { ROLE_DEFINITIONS } from "../roles.mjs";
export function roleModule(ctx) {
  const def = ROLE_DEFINITIONS[ctx.role];
  if (!def) throw new Error('Role "' + ctx.role + '" not defined');
  const parts = [def.discipline];
  if (def.methodology) parts.push(def.methodology);
  return {
    instructions: parts.join("\n\n"),
    tools: def.tools,
    model: ctx.override?.model ?? def.defaultModel,
    thinking: ctx.override?.thinking ?? def.defaultThinking
  };
}