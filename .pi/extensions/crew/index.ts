import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { assemble, ROLES, SOULS } from "./lib/assembly.mjs";
import { governance } from "./lib/governance.mjs";
import { registerCommunicationTools } from "./lib/communication-tools.ts";

const rosterPath = (cwd, runId) => join(cwd, ".pi", "fabric", "crew-launch", `${runId}-roster.json`);

const output = value => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: value });

export default function (pi) {
  registerCommunicationTools(pi);

  pi.registerTool({
    name: "build_crew_member",
    label: "Crew: build member",
    description: "Assemble a Hall soul and role with a bounded, self-contained assignment.",
    parameters: Type.Object({ 
      name: Type.String(), 
      role: Type.String(), 
      task: Type.String(), 
      model: Type.Optional(Type.String()), 
      thinking: Type.Optional(Type.String()) 
    }),
    async execute(_id, input) { 
      return output(assemble(input.name, input.role, input.task, input)); 
    },
  });

  pi.registerTool({
    name: "start_crew",
    label: "Crew: start",
    description: "Start a lead-first Crew run. Creates the Lead actor directly and returns its actor ID.",
    parameters: Type.Object({
      task: Type.String(),
      outputPath: Type.Optional(Type.String()),
      model: Type.Optional(Type.String()),
      thinking: Type.Optional(Type.String()),
      discussionNumber: Type.Optional(Type.Number()),
      discussionUrl: Type.Optional(Type.String())
    }),
    async execute(_id, input, _sig, _upd, ctx) {
      const runId = crypto.randomUUID();
      const topic = `crew.${runId}`;
      const dir = join(ctx.cwd, ".pi", "fabric", "crew-launch");
      mkdirSync(dir, { recursive: true });
      
      const rFile = rosterPath(ctx.cwd, runId);
      writeFileSync(rFile, JSON.stringify({
        runId, 
        topic, 
        owner: "MockaSort-Studio", 
        repo: "hall-of-automata-cli",
        discussionNumber: input.discussionNumber ?? null,
        discussionUrl: input.discussionUrl ?? null,
        outputPath: input.outputPath ?? null,
        members: []
      }, null, 2));
      
      const assignment = `${input.task}
${governance({ 
        topic, 
        runId, 
        rosterFile: rFile, 
        outputPath: input.outputPath, 
        discussionNumber: input.discussionNumber, 
        discussionUrl: input.discussionUrl 
      })}`;
      
      const member = assemble("old-major", "lead", assignment, input);
      const lead = { 
        ...member, 
        runner: "pi", 
        extensions: true, 
        topics: [topic], 
        responseMode: "text", 
        delivery: "mailbox", 
        residency: "durable" 
      };
      
      // ACTUALLY CREATE THE LEAD AGENT (not just generate code)
      const createdLead = await pi.agents.create(lead);
      
      // Update roster with actual actor info
      const roster = JSON.parse(await pi.read(rFile));
      roster.lead = { 
        name: createdLead.name, 
        actorId: createdLead.id, 
        role: "lead" 
      };
      writeFileSync(rFile, JSON.stringify(roster, null, 2));
      
      // Start the Lead with its assignment
      await pi.agents.tell({ 
        id: createdLead.id, 
        message: "Begin the work in your initial assignment." 
      });
      
      // Return structured result (Option A)
      return output({
        runId,
        topic,
        leadId: createdLead.id,
        actorId: createdLead.id,
        name: createdLead.name,
        status: "started",
        rosterFile: rFile,
        discussionNumber: input.discussionNumber ?? null,
        discussionUrl: input.discussionUrl ?? null
      });
    },
  });

  pi.registerCommand("crew-start", {
    description: "Start a Crew dispatch. Optionally pass discussionNumber+discussionUrl to continue in an existing Discussion.",
    handler: async args => {
      if (!args?.trim()) throw new Error("Usage: /crew-start <problem statement>");
      
      // Call start_crew tool directly
      const result = await pi.tools.call({
        ref: "extensions.crew_start_crew",
        args: { task: args.trim() }
      });
      
      // Format output for CLI (Option B)
      const data = result.details;
      let output = `✅ Crew ${data.runId} started!

`;
      output += `  Run ID:    ${data.runId}
`;
      output += `  Topic:     ${data.topic}
`;
      output += `  Lead:      ${data.name} (${data.actorId})
`;
      output += `  Status:    ${data.status}
`;
      output += `  Roster:    ${data.rosterFile}
`;
      if (data.discussionUrl) {
        output += `  Discussion: ${data.discussionUrl}
`;
      }
      return output;
    },
  });
}