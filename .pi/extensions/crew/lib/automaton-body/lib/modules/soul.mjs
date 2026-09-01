import { gh } from "../gh.mjs";

// Live-fetched, never cached — same discipline as all Hall state.
// Fetches persona data from hall-of-automata/roster/<name>.md
const ROSTER_URL = "MockaSort-Studio/hall-of-automata";

function fetchPersona(name) {
  if (!name || typeof name !== "string") {
    throw new Error(`Invalid soul name: ${name}`);
  }
  
  // Clean the name to match roster file naming
  const cleanName = name.replace(/^@/, "").trim();
  
  try {
    const raw = gh([
      "api", 
      `repos/${ROSTER_URL}/contents/roster/${cleanName}.md`,
      "--jq", ".content"
    ]);
    return Buffer.from(raw, "base64").toString("utf8");
  } catch (error) {
    throw new Error(`Failed to fetch persona for ${cleanName}: ${error.message}`);
  }
}

// Soul module: pure character narrative from roster/<name>.md
// Live-fetched, never cached - same discipline as all Hall state
// This IS the persona, renamed to match Specialist 2.0 terminology
export function soulModule(ctx) {
  if (!ctx.name) throw new Error("soulModule requires ctx.name");
  return {
    instructions: fetchPersona(ctx.name),
    tools: []
  };
}
