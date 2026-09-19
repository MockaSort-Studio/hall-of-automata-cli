import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { Type } from "typebox";
import { terminalizeRostersForRemovedActors } from "../crew/lib/roster-terminal.mjs";
import { runtimeFor } from "./lib/shared-runtime.mjs";

const crewLaunchDir = (cwd: string) => join(cwd, CONFIG_DIR_NAME, "runtime", "crew-launch");

export default function runtimeExtension(pi: any): void {
  const runtime = runtimeFor(process.cwd());
  pi.registerTool({
    name: "runtime_launch_crew",
    label: "Runtime: launch crew",
    description: "Start Comm and Lifecycle, register actors, and launch a Crew in one operation.",
    parameters: Type.Object({
      agents: Type.Array(
        Type.Object({
          name: Type.String(),
          task: Type.String(),
          actorId: Type.Optional(Type.String()),
          model: Type.Optional(Type.String()),
          thinking: Type.Optional(
            Type.Union([Type.Literal("off"), Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
          ),
          tools: Type.Optional(Type.Array(Type.String())),
          extensionPaths: Type.Optional(Type.Array(Type.String())),
          bundles: Type.Optional(Type.Array(Type.String())),
          resident: Type.Optional(Type.Boolean()),
        }),
      ),
    }),
    async execute(_id, input) {
      const result = await runtime.launchCrew(input.agents);
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  });
  pi.registerTool({
    name: "runtime_cleanup",
    label: "Runtime: cleanup",
    description: "Remove every SDK worker and worktree owned by this Runtime session.",
    parameters: Type.Object({}),
    async execute() {
      const result = await runtime.stop();
      const removedIds = result.removals.filter((item: any) => item.removed && item.id).map((item: any) => item.id);
      const terminalizedRosters = terminalizeRostersForRemovedActors(crewLaunchDir(process.cwd()), removedIds);
      const details = { ...result, terminalizedRosters };
      return { content: [{ type: "text", text: JSON.stringify(details) }], details };
    },
  });
  pi.registerTool({
    name: "runtime_spawn_agent",
    label: "Runtime: spawn agent",
    description: "Start one standalone SDK agent in a fresh Git worktree.",
    parameters: Type.Object({
      name: Type.String(),
      task: Type.String(),
      actorId: Type.Optional(Type.String()),
      model: Type.Optional(Type.String()),
      thinking: Type.Optional(
        Type.Union([Type.Literal("off"), Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
      ),
      tools: Type.Optional(Type.Array(Type.String())),
      extensionPaths: Type.Optional(Type.Array(Type.String())),
      bundles: Type.Optional(Type.Array(Type.String())),
      resident: Type.Optional(Type.Boolean()),
    }),
    async execute(_id, input) {
      const agent = await runtime.spawn(input);
      return { content: [{ type: "text", text: JSON.stringify(agent) }], details: agent };
    },
  });
  pi.registerTool({
    name: "runtime_list_agents",
    label: "Runtime: list agents",
    description: "List SDK agents started in this Main session.",
    parameters: Type.Object({}),
    async execute() {
      const agents = await runtime.list();
      return { content: [{ type: "text", text: JSON.stringify(agents) }], details: agents };
    },
  });
  pi.registerTool({
    name: "runtime_start_comm",
    label: "Runtime: start communication",
    description: "Start this Crew runtime communication controller.",
    parameters: Type.Object({ actors: Type.Optional(Type.Array(Type.String())) }),
    async execute(_id, input) {
      const result = await runtime.startComm(input.actors);
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  });
  pi.registerTool({
    name: "runtime_send_message",
    label: "Runtime: send message",
    description: "Send one opaque payload from Main to an agent through the communication controller.",
    parameters: Type.Object({ to: Type.String(), payload: Type.Unknown() }),
    async execute(_id, input) {
      const result = await runtime.send(input.to, input.payload);
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  });
  pi.registerTool({
    name: "runtime_receive_message",
    label: "Runtime: receive message",
    description: "Claim one queued message for Main or a Crew actor.",
    parameters: Type.Object({ actorId: Type.Optional(Type.String()) }),
    async execute(_id, input) {
      const result = await runtime.receive(input.actorId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  });
  pi.registerTool({
    name: "runtime_inspect_comm",
    label: "Runtime: inspect communication",
    description: "Return payload-free communication controller events.",
    parameters: Type.Object({}),
    async execute() {
      const result = await runtime.inspectComm();
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  });
  pi.registerTool({
    name: "runtime_inspect_agent",
    label: "Runtime: inspect agent",
    description: "Return compact lifecycle and telemetry state for one SDK agent.",
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, input) {
      const result = await runtime.inspect(input.id);
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  });
  pi.registerTool({
    name: "runtime_delete_agent",
    label: "Runtime: delete agent",
    description: "Stop an SDK agent and remove its worktree.",
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, input) {
      const result = await runtime.remove(input.id);
      const terminalizedRosters = result.removed
        ? terminalizeRostersForRemovedActors(crewLaunchDir(process.cwd()), [input.id])
        : [];
      const details = { ...result, terminalizedRosters };
      return { content: [{ type: "text", text: JSON.stringify(details) }], details };
    },
  });
}
