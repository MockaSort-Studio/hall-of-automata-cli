import { ROLE_DEFINITIONS } from "../roles.mjs";
import { leadRole }      from "../roles/lead.mjs";
import { architectRole } from "../roles/architect.mjs";
import { developerRole } from "../roles/developer.mjs";
import { advisorRole }   from "../roles/advisor.mjs";

const ROLE_FUNCTIONS = { lead: leadRole, architect: architectRole, developer: developerRole, advisor: advisorRole };

export function roleModule(ctx) {
  const def = ROLE_DEFINITIONS[ctx.role];
  if (!def) throw new Error('Role "' + ctx.role + '" not defined. Available: ' + Object.keys(ROLE_DEFINITIONS).join(", "));
  const roleFn  = ROLE_FUNCTIONS[ctx.role];
  const roleDef = roleFn ? roleFn() : null;
  const parts   = [];
  parts.push(roleDef?.discipline ?? def.discipline);
  if (roleDef?.methodology ?? def.methodology) parts.push(roleDef?.methodology ?? def.methodology);
  return {
    instructions: parts.join("\n\n"),
    tools:    roleDef ? roleDef.tools    : def.tools,
    model:    ctx.override?.model    ?? (roleDef?.defaultModel    ?? def.defaultModel),
    thinking: ctx.override?.thinking ?? (roleDef?.defaultThinking ?? def.defaultThinking),
  };
}
