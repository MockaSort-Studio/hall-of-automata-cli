export const ARMORY = Object.freeze({});

export function resolveArmoryExtensions(declarations, catalog) {
  return declarations.map(name => {
    if (!Object.hasOwn(ARMORY, name)) throw new Error(`Declared extension "${name}" is absent from the Armory`);
    const tools = catalog
      .filter(tool => tool.sourceInfo?.source === name)
      .map(tool => tool.name);
    if (!tools.length) throw new Error(`Declared extension "${name}" is unavailable in runtime tool catalog`);
    return { name, tools: [...new Set(tools)] };
  });
}
