import { readFileSync } from "node:fs";

const ROOT = new URL("../../../../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("prompts/roles.json", ROOT), "utf8"));

export function roleModule(ctx) {
  const role = catalog[ctx.role];
  if (!role) throw new Error(`Role "${ctx.role}" not defined. Available: ${Object.keys(catalog).join(", ")}`);
  const instructions = readFileSync(new URL(`prompts/roles/${role.prompt}`, ROOT), "utf8").trim();
  return {
    instructions,
    tools: role.tools,
    thinking: ctx.override?.thinking ?? role.thinking,
    ...(ctx.override?.model ? { model: ctx.override.model } : {}),
  };
}
