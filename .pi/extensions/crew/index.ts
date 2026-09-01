import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { assemble } from "./lib/assembly.mjs";
import { registerCommunicationTools } from "./lib/communication-tools.ts";
import { registerCrewMessageRenderer } from "./lib/rendering.ts";
import { prepareCrew, queuedMessage } from "./lib/startup.mjs";

const output = (value, text = JSON.stringify(value)) => ({
  content: [{ type: "text", text }],
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
  registerCrewMessageRenderer(pi);

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
    description: "Prepare durable Crew state for immediate creation and wake in the same fabric_exec invocation.",
    parameters,
    renderCall(args, theme) {
      const task = args.task.length > 72 ? `${args.task.slice(0, 69)}...` : args.task;
      return new Text(
        theme.fg("toolTitle", theme.bold("Crew ")) + theme.fg("muted", task),
        0, 0,
      );
    },
    renderResult(result, { isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Preparing durable Crew..."), 0, 0);
      const details = result.details as { runId?: string; status?: string } | undefined;
      if (!details?.runId) return new Text(theme.fg("error", "Crew launch failed"), 0, 0);
      const id = details.runId.slice(0, 8);
      return new Text(
        theme.fg("success", theme.bold("✓ Crew queued")) +
          theme.fg("muted", `  ${id}`) +
          "\n" + theme.fg("dim", "Terminal result will return to this Pi session."),
        0, 0,
      );
    },
    async execute(_id, input, signal, _update, ctx) {
      const prepared = await prepareCrew(pi, input, { ...ctx, signal }, CONFIG_DIR_NAME);
      pi.appendEntry("crew-status-card", { runId: prepared.runId, phase: "queued" });
      return output({ ...prepared, status: "queued", launchRequired: true }, queuedMessage(prepared));
    },
  });

}
