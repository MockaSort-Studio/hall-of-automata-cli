// Local soul catalog — ported from hall-of-automata/agents.json
// Source of truth for crew assembly. No network calls.

export const CATALOG = {
  "aeeeiii": {
    display_name: "AEEEEEIII 🐑",
    roles: ["research", "advise", "synthesize"],
    domains: ["perception", "environment-modeling", "computer-vision", "autonomous-systems", "ai-research-synthesis"],
    scope_summary: "Deep research and advising on AI perception, environment modeling, and computer vision — literature synthesis, paper analysis, and conceptual guidance for autonomous systems work.",
  },
  "frontenzio": {
    display_name: "Frontenzio 🛠️",
    roles: ["implement", "debug"],
    domains: ["react", "typescript", "vite", "astro", "css", "web-performance", "frontend-debugging"],
    scope_summary: "React/TypeScript/Vite/Astro implementation specialist — builds frontend features, fixes bugs, and debugs against live URLs with render correctness, performance, and accessibility as hard constraints.",
  },
  "frontenzo": {
    display_name: "Frontenzo 🎨",
    roles: ["advise", "review"],
    domains: ["frontend-architecture", "ux-ui", "web-performance", "accessibility", "frontend-security", "web-inspection"],
    scope_summary: "Frontend design critic and advisor — architecture recommendations, UX/UI critique, accessibility audits, and performance analysis. Advises; does not implement.",
  },
  "hamlet": {
    display_name: "Hamlet 🐗",
    roles: ["implement", "debug", "triage"],
    domains: ["cpp", "build-systems", "debugging"],
    scope_summary: "C++17 high-performance specialist — implements features, fixes bugs, and investigates runtime misbehaviours in Bazel-managed codebases, working from CI output rather than running builds inline.",
  },
  "indiana-docs": {
    display_name: "Indiana Docs 🤠",
    roles: ["write", "review", "research"],
    domains: ["documentation"],
    scope_summary: "MkDocs documentation specialist — reads the codebase, then writes coherent, style-consistent Markdown pages, Google-style docstrings, and navigation config.",
  },
  "mergio": {
    display_name: "mergio 🤘",
    roles: ["implement", "advise", "triage"],
    domains: ["ci-cd", "git-ops", "build-systems", "infrastructure", "deployment", "pipeline-triage"],
    scope_summary: "CI/CD architect and pipeline enforcer — designs, refactors, and diagnoses GitHub Actions pipelines; enforces gate strategy; handles IaC and deployment workflows.",
  },
  "old-major": {
    display_name: "Old Major 🏛️",
    roles: ["triage", "route", "onboard", "synthesize"],
    domains: ["roster-management", "task-triage", "resource-stewardship", "context-synthesis", "onboarding", "automata-management"],
    scope_summary: "Entry point for all unlabeled invocations. Reads the roster catalog, picks the right specialist, synthesizes task context. Does not implement code or open PRs.",
  },
  "panoramix": {
    display_name: "Panoramix 🧪",
    roles: ["implement", "debug", "test"],
    domains: ["elixir", "phoenix", "ecto", "beam", "testing"],
    scope_summary: "Elixir/Phoenix/Ecto/LiveView implementation specialist — builds domain schemas, migrations, OTP processes, and LiveViews in Mix-managed codebases, using TDD as the verification gate.",
  },
  "pyrate": {
    display_name: "Captain Pyrate 🦜",
    roles: ["implement", "debug"],
    domains: ["python"],
    scope_summary: "Python software engineering specialist — implements features, fixes bugs, and handles packaging and deployment in Bazel-managed and uv-managed Python codebases.",
  },
  "snowball": {
    display_name: "Snowball 🐷",
    roles: ["implement", "review"],
    domains: ["hall-infrastructure", "persona-engineering"],
    scope_summary: "Hall infrastructure specialist and Old Major's squire — writes CI workflows, skill files, methodology documents, and persona templates; reviews automaton character sheets.",
  },
  "tomashco": {
    display_name: "Tomashco 🛹",
    roles: ["advise", "research", "triage"],
    domains: ["api-design", "event-driven-architecture", "data-security", "backend-triage"],
    scope_summary: "Backend architecture advisor — analyzes system design, API contracts, event-driven patterns, and data security concerns; scopes work for downstream implementation agents.",
  },
};

export function fetchCatalog(name) {
  const entry = CATALOG[name];
  if (!entry) throw new Error(`Unknown soul "${name}". Available: ${Object.keys(CATALOG).join(", ")}`);
  return { roles: entry.roles, domains: entry.domains, scope_summary: entry.scope_summary };
}
