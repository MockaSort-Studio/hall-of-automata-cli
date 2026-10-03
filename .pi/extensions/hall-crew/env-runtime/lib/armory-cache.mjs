import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { nixBinary } from "./nix-binary.mjs";

const exec = promisify(execFile);
export const armoryCache = JSON.parse(readFileSync(new URL("../armory-cache.json", import.meta.url), "utf8"));

async function cacheConfigured() {
  const { stdout } = await exec(nixBinary(), ["config", "show", "substituters"]);
  return stdout.includes(armoryCache.substituter);
}

// Realizing a Linux guest suite on a machine without the Armory cache fails with
// an opaque Nix error. Say what to do about it instead; the original reason is kept.
export async function explainMissingCache(error, { configured = cacheConfigured } = {}) {
  if (await configured().catch(() => true)) return error;
  const lines = [error?.stderr, error?.message].flatMap((text) => String(text ?? "").split("\n"));
  const reason = lines.find((line) => /Reason:/.test(line))?.trim() ?? lines.find((line) => line.trim())?.trim() ?? "unknown";
  return new Error(`Armory cache not configured (run scripts/setup-env.sh); ${reason}`);
}
