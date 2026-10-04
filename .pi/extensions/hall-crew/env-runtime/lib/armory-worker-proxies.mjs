import { createGuestSuiteRunner } from "./guest-suite-runner.mjs";
import { readWorkerArmoryConfig } from "./worker-armory-config.mjs";

const toolResult = (result) => ({ content: [{ type: "text", text: JSON.stringify(result) }], details: result });

// A guest that resolves its VM on every call, so the VM can be released while the
// worker is idle and booted again on demand without invalidating the proxies.
export const lazyGuest = (ensure) => ({
  fs: {
    writeFile: async (...args) => (await ensure()).fs.writeFile(...args),
    readFile: async (...args) => (await ensure()).fs.readFile(...args),
  },
  exec: async (...args) => (await ensure()).exec(...args),
});

// Installs only guest-described operations approved in this worker's trusted
// runtime config. This module imports no Armory suite implementation.
export async function registerArmoryWorkerProxies(pi, { config = readWorkerArmoryConfig(), guest }) {
  const registered = new Set();
  const runners = [];
  for (const suite of config.suites) {
    const runner = createGuestSuiteRunner({ guest, rootPath: suite.rootPath, operations: suite.tools });
    runners.push(runner);
    const descriptors = await runner.describe();
    for (const descriptor of descriptors) {
      if (registered.has(descriptor.name)) throw new Error(`Duplicate Armory operation: ${descriptor.name}`);
      registered.add(descriptor.name);
      pi.registerTool({
        name: descriptor.name,
        label: descriptor.name,
        description: descriptor.description,
        parameters: descriptor.parameters,
        async execute(_id, input) {
          return toolResult(await runner.invoke(descriptor.name, input));
        },
      });
    }
  }
  // Describing is cheap and exercises the same path as a call, so running it ahead of a
  // run boots the VM and primes the suite (its first-use setup) while the model thinks.
  return { warm: () => Promise.all(runners.map((runner) => runner.describe())).then(() => undefined) };
}
