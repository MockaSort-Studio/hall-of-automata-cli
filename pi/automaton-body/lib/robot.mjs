const NL = String.fromCharCode(10);
export function createRobot() {
  const installed = [];
  const robot = {
    install: function(module, context = {}) {
      installed.push({ module, context });
      return this;
    },
    build: function() {
      const fragments = [];
      const tools = [];
      let model, thinking;
      for (const { module, context } of installed) {
        const f = module(context);
        if (f.instructions) fragments.push(f.instructions);
        if (f.tools) f.tools.forEach(t => !tools.includes(t) && tools.push(t));
        if (f.model !== undefined) model = f.model;
        if (f.thinking !== undefined) thinking = f.thinking;
      }
      return {
        instructions: fragments.join(NL + NL + '---' + NL + NL),
        tools,
        model,
        thinking
      };
    }
  };
  return robot;
}