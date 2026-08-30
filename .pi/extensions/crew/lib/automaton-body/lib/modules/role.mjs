import { ROLE_DEFINITIONS } from "../roles.mjs";
import { leadRole } from "../roles/lead.mjs";
import { architectRole } from "../roles/architect.mjs";

const ROLE_FUNCTIONS = {
  lead: leadRole,
  architect: architectRole
};

export function roleModule(ctx) {
  const def = ROLE_DEFINITIONS[ctx.role];
  if (!def) throw new Error('Role "' + ctx.role + '" not defined');
  
  // Use role function if available
  const roleFn = ROLE_FUNCTIONS[ctx.role];
  const roleDef = roleFn ? roleFn() : null;
  
  const parts = [];
  if (roleDef && roleDef.discipline) {
    parts.push(roleDef.discipline);
  } else {
    parts.push(def.discipline);
  }
  
  if (roleDef && roleDef.methodology) {
    parts.push(roleDef.methodology);
  } else if (def.methodology) {
    parts.push(def.methodology);
  }
  
  return {
    instructions: parts.join("\n\n"),
    tools: roleDef ? roleDef.tools : def.tools,
    model: ctx.override?.model ?? (roleDef?.defaultModel ?? def.defaultModel),
    thinking: ctx.override?.thinking ?? (roleDef?.defaultThinking ?? def.defaultThinking)
  };
}
