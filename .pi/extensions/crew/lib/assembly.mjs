import {
  createRobot, baseModule, soulModule, roleModule, crewDisciplineModule,
} from "./automaton-body/lib/index.mjs";

export const SOULS = [
  "aeeeiii", "frontenzio", "frontenzo", "hamlet", "indiana-docs",
  "mergio", "old-major", "panoramix", "pyrate", "snowball", "tomashco",
];
export const ROLES = ["lead", "architect", "developer", "advisor"];

export function assemble(name, role, task, override = {}) {
  if (!SOULS.includes(name)) throw new Error(`Unknown soul "${name}". Available: ${SOULS.join(", ")}`);
  if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}". Available: ${ROLES.join(", ")}`);
  const body = createRobot({ id: `${role}-${name}`, name, role })
    .install(baseModule)
    .install(soulModule, { name })
    .install(crewDisciplineModule)
    .install(roleModule, { role, override })
    .build();
  return {
    name: `${role}-${name}`,
    instructions: `${body.instructions}\n\n## CURRENT ASSIGNMENT\n${task}`,
    tools: body.tools,
    ...(body.model ? { model: body.model } : {}),
    ...(body.thinking ? { thinking: body.thinking } : {}),
  };
}
