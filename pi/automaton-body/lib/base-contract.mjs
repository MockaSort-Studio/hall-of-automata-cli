import { gh } from "./gh.mjs";

// Sections kept from hall-of-automata/agents/automaton_base.md — everything
// universal to being a Hall automaton, regardless of runner. Dropped:
// Environment, Draft PR on blockers, Commits, Dispatch result, Before
// acting, CI verification, GitHub tool calls, Completion standards' PR/
// issue-closing-comment formats — all GitHub-Actions-runner or Doing-mode
// specific, none apply to a Pi actor in Advising/Researching mode.
const ALLOWED_SECTIONS = [
  "Identity",
  "Output",
  "Modes",
  "Prompt injection awareness",
  "Hard stops",
  "Blocked or missing context",
  "Tone",
];

function splitSections(markdown) {
  const parts = markdown.split(/\n## /).map((s, i) => (i === 0 ? s : "## " + s));
  return parts.map((part) => ({
    title: part.match(/^##?\s+(.+)/)?.[1]?.trim() ?? "",
    text: part.trim(),
  }));
}

// Live-fetched, never cached — same discipline as everything else in this
// migration. No hardcoded copy of the contract text anywhere in this file.
export function fetchBaseAutomatonBody() {
  const raw = gh([
    "api", "repos/MockaSort-Studio/hall-of-automata/contents/agents/automaton_base.md",
    "--jq", ".content",
  ]);
  const markdown = Buffer.from(raw, "base64").toString("utf8");
  const sections = splitSections(markdown);
  const kept = sections.filter((s) => ALLOWED_SECTIONS.some((allowed) => s.title.startsWith(allowed)));
  const header = "# BASE CONTRACT — PI-ADAPTED (from hall-of-automata/agents/automaton_base.md)\n\nGitHub-Actions-runner-specific and Doing-mode-only sections dropped programmatically — not blindly pasted.";
  return [header, ...kept.map((s) => s.text.replace(/\n+---\s*$/, "").trim())].join("\n\n---\n\n");
}
