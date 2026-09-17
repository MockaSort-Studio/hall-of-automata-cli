import {
  createRobot,
  ROLE_NAMES,
  safetyModule,
  soulModule,
  roleModule,
  validateRoleTools,
  crewDisciplineModule,
} from "./automaton-body/lib/index.mjs";
import { BASE_GITHUB_TOOLS, NAMES, getAutomaton } from "./roster.mjs";
import { resolveArmoryExtensions } from "./armory.mjs";

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
  const extensions = automaton.extensions.length
    ? resolveArmoryExtensions(automaton.extensions, override.runtimeTools || [])
    : [];
  const tools = [
    ...new Set([...BASE_GITHUB_TOOLS, ...body.tools, ...extensions.flatMap((extension) => extension.tools)]),
  ];
  return {
    name: `${role}-${name}`,
    instructions: `${body.instructions}\n\n## ARMORY\n${extensions.length ? `Resolved extension tools: ${extensions.map((extension) => `${extension.name} (${extension.tools.join(", ")})`).join("; ")}.` : "No domain extension is assigned."}${assignment ? `\n\n## BOUNDED ASSIGNMENT\n${assignment}` : ""}\n\n## CREW IDENTITY\nYour signed sender name is ${role}-${name}. Use this identity in every Crew communication.`,
    tools,
    ...(body.model ? { model: body.model } : {}),
    ...(body.thinking ? { thinking: body.thinking } : {}),
  };
}
