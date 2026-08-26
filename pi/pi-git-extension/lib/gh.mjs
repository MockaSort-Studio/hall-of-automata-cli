import { execFileSync } from "node:child_process";

export function gh(args, opts = {}) {
  return execFileSync("gh", args, { encoding: "utf8", ...opts }).trim();
}

export function ghJson(args, opts = {}) {
  const out = gh(args, opts);
  return out ? JSON.parse(out) : null;
}
