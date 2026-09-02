import { readFileSync } from "node:fs";

const ROSTER_DIR = new URL("../../../../roster/", import.meta.url);

function readSoul(name) {
  if (!name || typeof name !== "string") {
    throw new Error(`Invalid soul name: ${name}`);
  }
  const cleanName = name.replace(/^@/, "").trim();
  if (!/^[a-z][a-z0-9-]*$/.test(cleanName)) {
    throw new Error(`Invalid soul name: ${name}`);
  }
  try {
    return readFileSync(new URL(`${cleanName}.md`, ROSTER_DIR), "utf8").trim();
  } catch (error) {
    throw new Error(`Failed to read local soul for ${cleanName}: ${error.message}`);
  }
}

export function soulModule(ctx) {
  if (!ctx.name) throw new Error("soulModule requires ctx.name");
  return {
    instructions: readSoul(ctx.name),
    tools: [],
  };
}
