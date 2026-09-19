import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runtimeFor } from "../../runtime/lib/shared-runtime.mjs";
import { assemble } from "./assembly.mjs";

export function crewPaths(configDir, runId) {
  const root = join(configDir, "runtime", "crew-launch");
  return {
    roster: join(root, `${runId}-roster.json`),
    selected: join(root, `selected_crew_${runId}.json`),
    config: join(root, `${runId}.json`),
  };
}
const handle = (role, name, ordinal) => `${role}-${name}-${String(ordinal).padStart(2, "0")}`;
const runtimeIdentity = (name) => `## CREW IDENTITY\nYour exact Comm sender handle is ${name}.`;
const workerTask = (actor, runId, topic, input) =>
  `${actor.instructions}\n\n${runtimeIdentity(actor.handle)}\n\n## SDK CREW RUNTIME\nRUN: ${runId}\nTOPIC: ${topic}\nProcess ordinary Comm deliveries for this selected party. Do not create or inspect roster state. Only Main/Lifecycle removes workers.${actor.role === "lead" ? `\n\n## CREW INPUT\n${input.task}` : ""}`;

export function queuedMessage(prepared) {
  return `Crew ${prepared.runId} launched on the SDK runtime.`;
}
export async function prepareCrew(pi, input, ctx, configDir) {
  if (input.completionMode === "human-gated")
    throw new Error("SDK Crew does not yet support scheduled human-gated mode");
  if (String(input.task || "").trim().length > 8000) throw new Error("Crew task exceeds 8000 characters");
  const runId = crypto.randomUUID();
  const namespace = `crew-${runId}`;
  const topic = `crew.${runId}`;
  const paths = crewPaths(configDir, runId);
  const counts = new Map();
  const actors = input.members.map((member) => {
    if (!member.name?.trim() || !member.role?.trim()) throw new Error("Crew members require name and role.");
    const key = `${member.role}-${member.name}`;
    const ordinal = counts.get(key) ?? 0;
    counts.set(key, ordinal + 1);
    const assembled = assemble(member.name, member.role, member.task ?? "", {
      ...member,
      runtimeTools: pi.getAllTools(),
    });
    return { ...assembled, role: member.role, handle: handle(member.role, member.name, ordinal) };
  });
  const leads = actors.filter((actor) => actor.role === "lead");
  if (leads.length > 1) throw new Error("A selected Crew may contain at most one lead.");
  const agents = actors.map((actor) => ({
    name: actor.handle,
    actorId: `${namespace}-${actor.handle}`,
    namespace,
    crewMembers: actors.map((item) => item.handle),
    crewLead: leads[0]?.handle,
    task: workerTask(actor, runId, topic, input),
    tools: actor.tools,
    model: actor.model,
    thinking: actor.thinking ?? input.thinking,
    resident: true,
    initialTurn: actor.role === "lead" ? "startup" : "first-delivery",
    role: actor.role,
  }));
  const root = join(ctx.cwd, dirname(paths.roster));
  mkdirSync(root, { recursive: true });
  const selected = {
    runId,
    topic,
    members: actors.map(({ name, role, handle, tools, model, thinking }) => ({
      name,
      role,
      handle,
      tools,
      model,
      thinking,
    })),
  };
  const kickoff = leads.length ? undefined : { kind: "kickoff", task: input.task, coordinator: "main" };
  try {
    writeFileSync(join(ctx.cwd, paths.selected), JSON.stringify(selected, null, 2));
    writeFileSync(
      join(ctx.cwd, paths.roster),
      JSON.stringify(
        { runId, topic, runtime: "sdk", status: "queued", members: [], selectedCrew: paths.selected },
        null,
        2,
      ),
    );
    writeFileSync(
      join(ctx.cwd, paths.config),
      JSON.stringify(
        {
          runId,
          topic,
          rosterFile: paths.roster,
          agents,
          kickoff,
          adapters:
            input.githubDiscussion === false
              ? []
              : [
                  {
                    id: "github-discussion",
                    runId,
                    startedAt: new Date().toISOString(),
                    category: input.discussionCategory ?? "General",
                    stateFile: join(configDir, "runtime", "crew-launch", `${runId}-github-discussion.json`),
                  },
                ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    for (const path of Object.values(paths)) rmSync(join(ctx.cwd, path), { force: true });
    throw error;
  }
  return { runId, topic, rosterFile: paths.roster, configFile: paths.config, selectedCrewFile: paths.selected, agents };
}
export async function launchPreparedCrew(cwd, prepared) {
  const config = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
  const rosterPath = join(cwd, prepared.rosterFile);
  let roster = JSON.parse(readFileSync(rosterPath, "utf8"));
  if (roster.status !== "queued") return { runId: roster.runId, topic: roster.topic, status: roster.status };
  roster.status = "launching";
  writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
  try {
    const runtime = runtimeFor(cwd);
    const launched = await runtime.launchCrew(config.agents, config.adapters);
    if (config.kickoff) await runtime.broadcast(config.agents[0].namespace, config.kickoff);
    const lead = launched.agents.find(
      (agent) => config.agents.find((item) => item.actorId === agent.id)?.role === "lead",
    );
    roster = JSON.parse(readFileSync(rosterPath, "utf8"));
    Object.assign(roster, {
      status: "started",
      comm: launched.comm,
      lead: lead && { name: lead.name, actorId: lead.id },
      members: launched.agents.map((agent, index) => ({
        name: agent.name,
        actorId: agent.id,
        role: config.agents[index].role,
      })),
    });
    writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
    return {
      runId: roster.runId,
      topic: roster.topic,
      status: "started",
      leadId: lead?.id,
      memberIds: launched.agents.map((agent) => agent.id),
      comm: launched.comm,
    };
  } catch (error) {
    roster.status = "failed";
    roster.launchError = String(error);
    writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
    throw error;
  }
}
