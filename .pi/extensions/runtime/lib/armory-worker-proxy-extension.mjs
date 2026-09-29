import { createGuestSuiteRunner } from "./guest-suite-runner.mjs";
import { readWorkerArmoryConfig } from "./worker-armory-config.mjs";

const toolResult = (result) => ({ content: [{ type: "text", text: JSON.stringify(result) }], details: result });

// Installs only guest-described operations approved in this worker's trusted
// runtime config. This extension imports no Armory suite implementation.
export async function registerArmoryWorkerProxies(pi, { config = readWorkerArmoryConfig(), vm } = {}) {
  if (!vm) {
    const { ensureActiveGondolinVm } = await import("./worker-gondolin-extension.mjs");
    vm = ensureActiveGondolinVm();
  }
  const registered = new Set();
  for (const suite of config.suites) {
    const runner = createGuestSuiteRunner({ guest: await vm, rootPath: suite.rootPath, operations: suite.tools });
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
}

export default function armoryWorkerProxyExtension(pi) {
  pi.on("session_start", () => registerArmoryWorkerProxies(pi));
}
