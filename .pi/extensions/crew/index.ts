import { Type } from "typebox";

function request(task, model, thinking) {
  const options = { task, ...(model ? { model } : {}), ...(thinking ? { thinking } : {}) };
  const code = `const { startCrew } = await import("./.pi/extensions/crew/lib/entrypoint.mjs");\nreturn await startCrew(${JSON.stringify(options)});`;
  return `Run this using fabric_exec exactly as written:\n\n${code}`;
}

export default function (pi) {
  pi.registerTool({
    name: "start_crew",
    label: "Crew: start",
    description: "Start a lead-first Pi Fabric Crew dispatch. Main creates only the lead.",
    parameters: Type.Object({
      task: Type.String({ description: "Self-contained task for the Crew lead" }),
      model: Type.Optional(Type.String()),
      thinking: Type.Optional(Type.String()),
    }),
    async execute(_id, input) {
      pi.sendUserMessage(request(input.task, input.model, input.thinking), { deliverAs: "followUp" });
      return { content: [{ type: "text", text: "Crew startup queued for fabric_exec." }] };
    },
  });

  pi.registerCommand("crew-start", {
    description: "Start a lead-first Pi Fabric Crew dispatch",
    handler: async (args) => {
      const task = args?.trim();
      if (!task) throw new Error("Usage: /crew-start <task>");
      pi.sendUserMessage(request(task), { deliverAs: "followUp" });
    },
  });
}
