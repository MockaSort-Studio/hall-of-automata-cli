import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Runtime } from "./lib/runtime.mjs";

export default function runtimeExtension(pi: ExtensionAPI): void {
  const runtime = new Runtime(process.cwd(), import.meta.resolve("@earendil-works/pi-coding-agent"));
  pi.registerTool({
    name: "runtime_spawn_agent",
    label: "Runtime: spawn agent",
    description: "Start one standalone SDK agent in a fresh Git worktree.",
    parameters: Type.Object({
      name: Type.String(),
      task: Type.String(),
      model: Type.Optional(Type.String()),
      thinking: Type.Optional(
        Type.Union([Type.Literal("off"), Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
      ),
      tools: Type.Optional(Type.Array(Type.String())),
      extensionPaths: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(_id, input) {
      const agent = runtime.spawn(input);
      return { content: [{ type: "text", text: JSON.stringify(agent) }], details: agent };
    },
  });
  pi.registerTool({
    name: "runtime_list_agents",
    label: "Runtime: list agents",
    description: "List SDK agents started in this Main session.",
    parameters: Type.Object({}),
    async execute() {
      const agents = runtime.list();
      return { content: [{ type: "text", text: JSON.stringify(agents) }], details: agents };
    },
  });
  pi.registerTool({
    name: "runtime_inspect_agent",
    label: "Runtime: inspect agent",
    description: "Return compact lifecycle and telemetry state for one SDK agent.",
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, input) {
      const result = runtime.inspect(input.id);
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  });
  pi.registerTool({
    name: "runtime_delete_agent",
    label: "Runtime: delete agent",
    description: "Stop one SDK agent and remove its worktree.",
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, input) {
      const result = runtime.remove(input.id);
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  });
}
