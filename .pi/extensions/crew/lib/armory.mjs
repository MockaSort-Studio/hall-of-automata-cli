const ARMORY = {
  elixir: { extension: "elixir-pi", tools: ["mix_compile", "mix_test", "phoenix_logs", "elixir_debug_live"] },
  "otp-beam": { extension: "elixir-pi", tools: ["mix_compile", "mix_test", "elixir_debug_live"] },
  erlang: { extension: "elixir-pi", tools: ["mix_compile", "mix_test"] },
  mix: { extension: "elixir-pi", tools: ["mix_compile", "mix_test"] },
  phoenix: { extension: "elixir-pi", tools: ["phoenix_logs", "elixir_debug_live"] },
  ecto: { extension: "elixir-pi", tools: ["mix_test", "elixir_debug_live"] },
  liveview: { extension: "elixir-pi", tools: ["phoenix_logs", "elixir_debug_live"] },
};

export function resolveArmory(domain, availableTools = []) {
  const available = new Set(availableTools);
  const entries = [...new Set(domain)].map(name => ({ name, ...ARMORY[name] })).filter(entry => entry.extension);
  const requested = [...new Set(entries.flatMap(entry => entry.tools))];
  const tools = requested.filter(tool => available.has(tool));
  return { extensions: [...new Set(entries.map(entry => entry.extension))], tools, missing: requested.filter(tool => !available.has(tool)) };
}
