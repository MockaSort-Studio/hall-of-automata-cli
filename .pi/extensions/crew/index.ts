import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { assemble } from "./lib/assembly.mjs";
import { registerCommunicationTools } from "./lib/communication-tools.ts";
import { launchCode, prepareCrew } from "./lib/startup.mjs";

const output = value => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
  details: value,
});

const parameters = Type.Object({
  task: Type.String(),
  outputPath: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  thinking: Type.Optional(Type.String()),
  discussionNumber: Type.Optional(Type.Integer({ minimum: 1 })),
  discussionUrl: Type.Optional(Type.String()),
});

export default function crewExtension(pi: ExtensionAPI) {
  registerCommunicationTools(pi);

  pi.registerTool({
    name: "build_crew_member",
    label: "Crew: build member",
    description: "Assemble a Hall soul and role with a bounded assignment.",
    parameters: Type.Object({
      name: Type.String(), role: Type.String(), task: Type.String(),
      model: Type.Optional(Type.String()), thinking: Type.Optional(Type.String()),
    }),
    async execute(_id, input) {
      return output(assemble(input.name, input.role, input.task, input));
    },
  });

  pi.registerTool({
    name: "start_crew",
    label: "Crew: start",
    description: "Prepare a durable Lead and queue its Fabric launch.",
    parameters,
    async execute(_id, input, signal, _update, ctx) {
      const prepared = await prepareCrew(pi, input, { ...ctx, signal }, CONFIG_DIR_NAME);
      pi.sendUserMessage(
        `Run this using fabric_exec exactly as written:\n\n${launchCode(prepared.configFile)}`,
        { deliverAs: "followUp" },
      );
      return output({ ...prepared, status: "queued" });
    },
  });

  pi.registerCommand("crew-start", {
    description: "Queue a durable Crew dispatch.",
    handler: async (args, ctx) => {
      if (!args?.trim()) throw new Error("Usage: /crew-start <problem statement>");
      const prepared = await prepareCrew(
        pi, { task: args.trim() }, ctx, CONFIG_DIR_NAME,
      );
      pi.sendUserMessage(
        `Run this using fabric_exec exactly as written:\n\n${launchCode(prepared.configFile)}`,
        { deliverAs: "followUp" },
      );
      ctx.ui.notify(`Crew ${prepared.runId} launch queued`, "info");
    },
  });
}
