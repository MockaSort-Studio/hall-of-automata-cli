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
  // Role tools are the functional baseline. Roster tools are this automaton's
  // domain additions. They are operation names, not extension declarations.
  const tools = [...new Set([...body.tools, ...automaton.tools])];
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
