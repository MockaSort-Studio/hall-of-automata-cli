import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runtimeFor } from "../../runtime/lib/shared-runtime.mjs";
import { assemble } from "./assembly.mjs";
export function crewPaths(configDir, runId) {
  const root = join(configDir, "runtime", "crew-launch");
  return { roster: join(root, `${runId}-roster.json`), config: join(root, `${runId}.json`) };
}
const handle = (role, name, ordinal) => `${role}-${name}-${String(ordinal).padStart(2, "0")}`;
export function queuedMessage(prepared) {
  return `Crew ${prepared.runId} launched on the SDK runtime.`;
}
function memberTask(member, runId, topic) {
  return `${member.instructions}\n\n## SDK CREW RUNTIME\nRUN: ${runId}\nTOPIC: ${topic}\nYou are an SDK Crew specialist. Remain resident and process communication deliveries from the Lead. On a kickoff delivery, use its goal and context, find your assignment, and execute only it. If it has dependencies, wait for directed complete messages from each dependency. On completion, use comm_notify_many to notify the Lead and only assignments that depend on you.`;
}
function leadTask(lead, task, runId, topic, members) {
  return `${lead.instructions}\n\n## SDK CREW LEAD ASSIGNMENT\nRUN: ${runId}\nTOPIC: ${topic}\nTASK: ${task}\nMEMBERS: ${members.map((m) => m.name).join(", ")}\n\nFirst call comm_kickoff with the high-level goal, relevant context, and one bounded assignment (including dependencies) for every listed member. It broadcasts the validated plan through Comm. Then use comm_request/comm_notify to coordinate resident specialists. When complete, call comm_notify_all with the exact final report for Main and the Crew.`;
}
export async function prepareCrew(pi, input, ctx, configDir) {
  if (input.completionMode === "human-gated")
    throw new Error("SDK Crew does not yet support scheduled human-gated mode");
  if (String(input.task || "").trim().length > 8000) throw new Error("Crew task exceeds 8000 characters");
  const runId = crypto.randomUUID(),
    namespace = `crew-${runId}`,
    topic = `crew.${runId}`,
    paths = crewPaths(configDir, runId),
    absoluteRoster = join(ctx.cwd, paths.roster);
  const counts = new Map();
  const members = input.members.map((member) => {
    if (!member.name?.trim() || !member.role?.trim()) throw new Error("Crew members require name and role.");
    const key = `${member.role}-${member.name}`,
      ordinal = counts.get(key) ?? 0;
    counts.set(key, ordinal + 1);
    return {
      ...assemble(member.name, member.role, "", { runtimeTools: pi.getAllTools() }),
      role: member.role,
      handle: handle(member.role, member.name, ordinal),
    };
  });
  const leadHandle = handle("lead", "old-major", 0);
  const memberAgents = members.map((member) => ({
    name: member.handle,
    actorId: `${namespace}-${member.handle}`,
    namespace,
    crewMembers: members.map((item) => item.handle),
    crewLead: leadHandle,
    task: `${memberTask(member, runId, topic)}\nLead handle: ${leadHandle}. On completion call comm_notify_many with to: ["${leadHandle}"] and payload containing kind: "complete" plus your file-backed evidence.`,
    tools: member.tools,
    model: member.model,
    thinking: member.thinking ?? input.thinking,
    resident: true,
    initialTurn: "first-delivery",
    role: member.role,
  }));
  const lead = assemble("old-major", "lead", "", input),
    agents = [
      ...memberAgents,
      {
        name: leadHandle,
        actorId: `${namespace}-${leadHandle}`,
        namespace,
        crewMembers: members.map((item) => item.handle),
        crewLead: leadHandle,
        task: leadTask(lead, input.task, runId, topic, memberAgents),
        tools: lead.tools,
        model: lead.model ?? input.model,
        thinking: lead.thinking ?? input.thinking ?? "medium",
        resident: true,
        initialTurn: "startup",
        role: "lead",
      },
    ];
  const absoluteConfig = join(ctx.cwd, paths.config);
  mkdirSync(dirname(absoluteRoster), { recursive: true });
  try {
    writeFileSync(
      absoluteRoster,
      JSON.stringify(
        {
          runId,
          topic,
          runtime: "sdk",
          status: "queued",
          preparedAt: new Date().toISOString(),
          completionMode: "unattended",
          outputPath: input.outputPath ?? null,
          members: [],
        },
        null,
        2,
      ),
    );
    writeFileSync(absoluteConfig, JSON.stringify({ runId, topic, rosterFile: paths.roster, agents }));
  } catch (error) {
    rmSync(absoluteRoster, { force: true });
    rmSync(absoluteConfig, { force: true });
    throw error;
  }
  return { runId, topic, rosterFile: paths.roster, configFile: paths.config, agents };
}
export async function launchPreparedCrew(cwd, prepared) {
  const rosterPath = join(cwd, prepared.rosterFile),
    config = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
  let roster = JSON.parse(readFileSync(rosterPath, "utf8"));
  if (roster.status !== "queued") return { runId: roster.runId, topic: roster.topic, status: roster.status };
  roster.status = "launching";
  roster.batchStartedAt = new Date().toISOString();
  writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
  try {
    const launched = await runtimeFor(cwd).launchCrew(config.agents),
      lead = launched.agents.at(-1),
      members = launched.agents.slice(0, -1);
    roster = JSON.parse(readFileSync(rosterPath, "utf8"));
    Object.assign(roster, {
      status: "started",
      runtime: "sdk",
      comm: launched.comm,
      lead: { name: lead.name, actorId: lead.id },
      members: members.map((agent, index) => ({
        name: agent.name,
        actorId: agent.id,
        role: config.agents[index].role,
      })),
      batchCreatedAt: new Date().toISOString(),
    });
    writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
    return {
      runId: roster.runId,
      topic: roster.topic,
      status: "started",
      leadId: lead.id,
      memberIds: members.map((agent) => agent.id),
      comm: launched.comm,
    };
  } catch (error) {
    roster = JSON.parse(readFileSync(rosterPath, "utf8"));
    roster.status = "failed";
    roster.launchError = String(error);
    writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
    throw error;
  }
}
