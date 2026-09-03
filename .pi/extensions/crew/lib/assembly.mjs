import {
  createRobot, safetyModule, soulModule, roleModule, crewDisciplineModule,
} from "./automaton-body/lib/index.mjs";
import { BASE_GITHUB_TOOLS, NAMES, getAutomaton } from "./roster.mjs";

export const SOULS = NAMES;
export const ROLES = ["lead", "architect", "developer", "advisor"];

export function assemble(name, role, task, override = {}) {
  const automaton = getAutomaton(name);
  const assignment = String(task || "").trim();
  if (assignment.length > 4000) throw new Error("Crew assignment exceeds 4000 characters");
  if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}". Available: ${ROLES.join(", ")}`);
  const body = createRobot({ id: `${role}-${name}`, name, role })
    .install(safetyModule)
    .install(soulModule, { name })
    .install(crewDisciplineModule)
    .install(roleModule, { role, override })
    .build();
  const tools = [...new Set([...BASE_GITHUB_TOOLS, ...body.tools, ...automaton.allowed_tools])];
  return {
    name: `${role}-${name}`,
    instructions: `${body.instructions}${assignment ? `\n\n## BOUNDED ASSIGNMENT\n${assignment}` : ""}\n\n## CREW IDENTITY\nYour signed sender name is ${role}-${name}. Every crew_* Discussion call requires from: this name and your completed funny persona signature.`,
    tools,
    ...(body.model ? { model: body.model } : {}),
    ...(body.thinking ? { thinking: body.thinking } : {}),
  };
}
