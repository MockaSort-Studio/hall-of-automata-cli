import assert from "node:assert/strict";
import test from "node:test";
import { registerArmoryWorkerProxies } from "../../.pi/extensions/runtime/lib/armory-worker-proxy-extension.mjs";

const rootPath = "/nix/store/0123456789abcdefghijklmnopqrstuv-github";

function guest() {
  const files = new Map();
  return {
    fs: {
      async writeFile(path, value) { files.set(path, value); },
      async readFile() {
        const request = JSON.parse([...files.values()].at(-1));
        return JSON.stringify(request.operation ? { result: { issue: 1 } } : {
          operations: [{ name: "github_issue_view", description: "View an issue", parameters: { type: "object" } }],
        });
      },
    },
    async exec() { return { exitCode: 0 }; },
  };
}

test("worker proxy registers only guest-described approved operations", async () => {
  const tools = [];
  await registerArmoryWorkerProxies(
    { registerTool: (tool) => tools.push(tool) },
    { config: { suites: [{ rootPath, tools: ["github_issue_view"] }] }, vm: guest() },
  );
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "github_issue_view");
  assert.deepEqual(await tools[0].execute("id", { number: 1 }), {
    content: [{ type: "text", text: JSON.stringify({ issue: 1 }) }], details: { issue: 1 },
  });
});
