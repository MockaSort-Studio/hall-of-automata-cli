import { execFileSync } from "node:child_process";

/** Minimal host adapter used only while assembling live Hall contracts. */
export function gh(args, opts = {}) {
  return execFileSync("gh", args, { encoding: "utf8", ...opts }).trim();
}
