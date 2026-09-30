import {
  createRobot,
  ROLE_NAMES,
  safetyModule,
  soulModule,
  roleModule,
  validateRoleTools,
  crewDisciplineModule,
} from "./automaton-body/lib/index.mjs";
import { NAMES, getAutomaton } from "./roster.mjs";
import { assignmentContext } from "./assignment-context.mjs";
import { GITHUB_BASE_TOOLS, GITHUB_BASE_TOOL_SET } from "./github-base-tools.mjs";

export const SOULS = NAMES;
export const ROLES = ROLE_NAMES;

export function validateAvailableRoleTools(tools, role) {
  validateRoleTools(tools, role);
}

export function assemble(name, role, task, override = {}) {
  const automaton = getAutomaton(name);
  const assignment = String(task || "").trim();
  if (assignment.length > 4000) throw new Error("Crew assignment exceeds 4000 characters");
  if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}". Available: ${ROLES.join(", ")}`);
  const body = createRobot({ id: `${role}-${name}`, name, role })
    .install(safetyModule)
    .install(soulModule, { persona: automaton.persona })
    .install(crewDisciplineModule)
    .install(roleModule, { role, override })
    .build();
  // Role and roster tools are capabilities. An assignment may narrow every
  // operation, including built-ins and Armory operations; GitHub capabilities
  // are never granted until explicitly requested.
  const capabilities = [...new Set([...body.tools, ...automaton.tools, ...GITHUB_BASE_TOOLS])];
  const defaultTools = capabilities.filter((tool) => !GITHUB_BASE_TOOL_SET.has(tool));
  const requested = override.allowedOperations;
  if (requested !== undefined && (!Array.isArray(requested) || requested.some((tool) => !capabilities.includes(tool))))
    throw new Error(`Crew assignment has an operation outside ${role}'s capabilities.`);
  const tools = requested === undefined ? defaultTools : [...new Set(requested)];
  return {
    name: `${role}-${name}`,
    instructions: `${body.instructions}${automaton.tools.length ? `\n\n## ARMORY\nDeclared domain tools: ${automaton.tools.join(", ")}.` : ""}${assignment ? `\n\n## BOUNDED ASSIGNMENT\n${assignment}` : ""}${assignmentContext(override)}`,
    tools,
    commTools: body.commTools,
    ...(body.extensionPaths ? { extensionPaths: body.extensionPaths } : {}),
    ...(body.model ? { model: body.model } : {}),
    ...(body.thinking ? { thinking: body.thinking } : {}),
  };
}
