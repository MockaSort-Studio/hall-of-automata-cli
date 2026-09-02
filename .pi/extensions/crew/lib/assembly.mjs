import {
  createRobot, baseModule, soulModule, roleModule, crewDisciplineModule,
} from "./automaton-body/lib/index.mjs";
import { BASE_GITHUB_TOOLS, NAMES, getAutomaton } from "./roster.mjs";

export const SOULS = NAMES;
export const ROLES = ["lead", "architect", "developer", "advisor"];

export function assemble(name, role, task, override = {}) {
  const automaton = getAutomaton(name);
  if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}". Available: ${ROLES.join(", ")}`);
  const body = createRobot({ id: `${role}-${name}`, name, role })
    .install(baseModule)
    .install(soulModule, { name })
    .install(crewDisciplineModule)
    .install(roleModule, { role, override })
    .build();
  const tools = [...new Set([...BASE_GITHUB_TOOLS, ...body.tools, ...automaton.allowed_tools])];
  return {
    name: `${role}-${name}`,
    instructions: `${body.instructions}\n\n## CREW IDENTITY\nYour signed sender name is ${role}-${name}. Every crew_* Discussion call requires from: this name and your completed funny persona signature.`,
    tools,
    ...(body.model ? { model: body.model } : {}),
    ...(body.thinking ? { thinking: body.thinking } : {}),
  };
}
