import { readFileSync } from "node:fs";
const ROSTER_DIR = new URL("../../../../roster/", import.meta.url);

function field(markdown, name) {
  return markdown.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`))?.[1]?.trim();
}

export function compactSoul(markdown) {
  const title = markdown.match(/^#\s+(.+)/m)?.[1]?.trim();
  const domains = markdown.match(/## Domains\s+([\s\S]*?)(?=\n---|\n## |$)/)?.[1]
    ?.split("\n").filter(line => line.trim().startsWith("-")).slice(0, 8).join("\n");
  const lines = ["## PERSONA", title, field(markdown, "Tone"), field(markdown, "Voice"), field(markdown, "Signature"), domains];
  return lines.filter(Boolean).join("\n").slice(0, 2400);
}

function readSoul(name) {
  const clean = String(name || "").replace(/^@/, "").trim();
  if (!/^[a-z][a-z0-9-]*$/.test(clean)) throw new Error(`Invalid soul name: ${name}`);
  try { return compactSoul(readFileSync(new URL(`${clean}.md`, ROSTER_DIR), "utf8")); }
  catch (error) { throw new Error(`Failed to read local soul for ${clean}: ${error.message}`); }
}

export function soulModule(ctx) {
  if (!ctx.name) throw new Error("soulModule requires ctx.name");
  return { instructions: readSoul(ctx.name), tools: [] };
}
