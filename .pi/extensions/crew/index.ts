import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { assemble, ROLES, SOULS } from "./lib/assembly.mjs";
import { governance } from "./lib/governance.mjs";
import { registerCommunicationTools } from "./lib/communication-tools.ts";

const rosterPath = (cwd, runId) => join(cwd, ".pi", "fabric", "crew-launch", `${runId}-roster.json`);
const launchCode = path => [
  `const cfg = JSON.parse(await pi.read(${JSON.stringify(path)}));`,
  "const lead = await agents.create(cfg.lead);",
  "return { runId: cfg.runId, topic: cfg.topic, leadId: lead.id, status: \"created\" };",
].join("\n");
const output = value => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: value });

export default function (pi) {
  registerCommunicationTools(pi);

  pi.registerTool({
    name: "build_crew_member", label: "Crew: build member",
    description: "Assemble a Hall soul and role with a bounded, self-contained assignment.",
    parameters: Type.Object({ name: Type.String(), role: Type.String(), task: Type.String(), model: Type.Optional(Type.String()), thinking: Type.Optional(Type.String()) }),
    async execute(_id, input) { return output(assemble(input.name, input.role, input.task, input)); },
  });

  pi.registerTool({
    name: "start_crew", label: "Crew: start",
    description: "Queue a lead-first Crew run. The lead creates one kickoff and dispatches the smallest capable crew.",
    parameters: Type.Object({ task: Type.String(), outputPath: Type.Optional(Type.String()), model: Type.Optional(Type.String()), thinking: Type.Optional(Type.String()) }),
    async execute(_id, input, _sig, _upd, ctx) {
      const runId = crypto.randomUUID();
      const topic = `crew.${runId}`;
      const dir = join(ctx.cwd, ".pi", "fabric", "crew-launch");
      mkdirSync(dir, { recursive: true });
      const rFile = rosterPath(ctx.cwd, runId);
      writeFileSync(rFile, JSON.stringify({ runId, topic, owner: "MockaSort-Studio", repo: "hall-of-automata-cli", discussionNumber: null, discussionUrl: null, outputPath: input.outputPath ?? null, members: [] }, null, 2));
      const assignment = `${input.task}\n${governance({ topic, runId, rosterFile: rFile, outputPath: input.outputPath })}`;
      const member = assemble("old-major", "lead", assignment, input);
      const lead = { ...member, runner: "pi", extensions: true, topics: [topic], responseMode: "text", delivery: "mailbox", residency: "session" };
      const cfgPath = join(dir, `${runId}.json`);
      writeFileSync(cfgPath, JSON.stringify({ runId, topic, lead }));
      pi.sendUserMessage(`Run this using fabric_exec exactly as written:\n\n${launchCode(`.pi/fabric/crew-launch/${runId}.json`)}`, { deliverAs: "followUp" });
      return output({ runId, topic, souls: SOULS, roles: ROLES });
    },
  });

  pi.registerCommand("crew-start", {
    description: "Start a Crew dispatch",
    handler: async args => {
      if (!args?.trim()) throw new Error("Usage: /crew-start <problem statement>");
      pi.sendUserMessage(`Use start_crew with this task: ${args.trim()}`, { deliverAs: "followUp" });
    },
  });
}
