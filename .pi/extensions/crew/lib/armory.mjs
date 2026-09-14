export const ARMORY = Object.freeze({ "pi-elixir": {} });
export function resolveArmory(extensions, availableTools = []) {
  const available = new Set(availableTools);
  const known = [...new Set(extensions)].filter(name => ARMORY[name]);
  return { extensions: known, tools: [...available].filter(name => known.includes(name)) };
}
