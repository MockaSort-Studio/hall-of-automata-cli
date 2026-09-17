import { existsSync, readFileSync } from "node:fs";
const ROOT = new URL("../../../../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("prompts/roles.json", ROOT), "utf8"));
const THINKING = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
for (const [name, role] of Object.entries(catalog)) {
  if (!role || typeof role.prompt !== "string" || !existsSync(new URL(`prompts/roles/${role.prompt}`, ROOT)))
    throw new Error(`Invalid role prompt: ${name}`);
  if (
    !Array.isArray(role.tools) ||
    new Set(role.tools).size !== role.tools.length ||
    !role.tools.every((tool) => typeof tool === "string")
  )
    throw new Error(`Invalid role tools: ${name}`);
  if (!THINKING.has(role.thinking)) throw new Error(`Invalid role thinking: ${name}`);
}
export const ROLE_NAMES = Object.freeze(Object.keys(catalog));
export function validateRoleTools(availableTools, roleName) {
  const available = new Set(availableTools);
  const entries = roleName ? [[roleName, catalog[roleName]]] : Object.entries(catalog);
  for (const [name, role] of entries) {
    if (!role) throw new Error(`Role "${name}" not defined`);
    const missing = role.tools.filter((tool) => !available.has(tool));
    if (missing.length) throw new Error(`Role ${name} requires unavailable tools: ${missing.join(", ")}`);
  }
}
export function roleModule(ctx) {
  const role = catalog[ctx.role];
  if (!role) throw new Error(`Role "${ctx.role}" not defined. Available: ${Object.keys(catalog).join(", ")}`);
  return {
    instructions: readFileSync(new URL(`prompts/roles/${role.prompt}`, ROOT), "utf8").trim(),
    tools: role.tools,
    thinking: ctx.override?.thinking ?? role.thinking,
    ...(ctx.override?.model ? { model: ctx.override.model } : {}),
  };
}
