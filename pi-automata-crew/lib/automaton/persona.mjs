import { gh } from "../../pi-git-extension/lib/gh.mjs";

// Soul — pure character, live-fetched, verbatim, never trimmed here.
// Trimming (if any) happens per-mode in resolve.mjs, not by mutating the source.
export function fetchPersona(name) {
  const raw = gh([
    "api", `repos/MockaSort-Studio/hall-of-automata/contents/roster/${name}.md`,
    "--jq", ".content",
  ]);
  return Buffer.from(raw, "base64").toString("utf8");
}
