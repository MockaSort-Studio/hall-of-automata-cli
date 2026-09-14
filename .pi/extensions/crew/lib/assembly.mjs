import {
  createRobot, ROLE_NAMES, safetyModule, soulModule, roleModule, validateRoleTools, crewDisciplineModule,
} from "./automaton-body/lib/index.mjs";
import { BASE_GITHUB_TOOLS, NAMES, getAutomaton } from "./roster.mjs";

export const SOULS = NAMES;
export const ROLES = ROLE_NAMES;

export function validateAvailableRoleTools(tools) { validateRoleTools(tools); }

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
  const tools = [...new Set([...BASE_GITHUB_TOOLS, ...body.tools])];
  return {
    name: `${role}-${name}`,
    instructions: `${body.instructions}\n\n## ARMORY\n${automaton.extensions.length ? `Assigned extension declarations: ${automaton.extensions.join(", ")}. Availability is not yet verified.` : "No domain extension is assigned."}${assignment ? `\n\n## BOUNDED ASSIGNMENT\n${assignment}` : ""}\n\n## CREW IDENTITY\nYour signed sender name is ${role}-${name}. Every crew_* Discussion call requires from: this name and your completed persona signature.`,
    tools,
    ...(body.model ? { model: body.model } : {}),
    ...(body.thinking ? { thinking: body.thinking } : {}),
  };
}
