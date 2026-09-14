const ARMORY = {
  crew: {}, fabric: {}, github: {},
  "github-actions": {}, shell: {}, markdown: {},
  cpp: {}, cmake: {}, bazel: {},
  python: {}, uv: {}, packaging: {},
  git: {}, "ci-cd": {},
  frontend: {}, "ux-ui": {}, accessibility: {},
  "computer-vision": {}, perception: {}, "autonomous-systems": {},
  "api-design": {}, "event-driven-architecture": {}, "data-security": {},
  documentation: {}, mkdocs: {}, react: {}, typescript: {}, vite: {}, astro: {}, css: {},
  elixir: { extension: "pi-elixir", tools: ["mix_compile", "mix_test", "phoenix_logs", "elixir_debug_live"] },
  "otp-beam": { extension: "pi-elixir", tools: ["mix_compile", "mix_test", "elixir_debug_live"] },
  erlang: { extension: "pi-elixir", tools: ["mix_compile", "mix_test"] },
  mix: { extension: "pi-elixir", tools: ["mix_compile", "mix_test"] },
  phoenix: { extension: "pi-elixir", tools: ["phoenix_logs", "elixir_debug_live"] },
  ecto: { extension: "pi-elixir", tools: ["mix_test", "elixir_debug_live"] },
  liveview: { extension: "pi-elixir", tools: ["phoenix_logs", "elixir_debug_live"] },
};
export const ARMORY_DOMAINS = Object.freeze(Object.keys(ARMORY));
export function resolveArmory(domain, availableTools = []) {
  const available = new Set(availableTools);
  const domains = [...new Set(domain)].filter(name => ARMORY[name]);
  const entries = domains.map(name => ARMORY[name]);
  const requested = [...new Set(entries.flatMap(entry => entry.tools ?? []))];
  return {
    domains,
    extensions: [...new Set(entries.map(entry => entry.extension).filter(Boolean))],
    tools: requested.filter(tool => available.has(tool)),
    missing: requested.filter(tool => !available.has(tool)),
  };
}
