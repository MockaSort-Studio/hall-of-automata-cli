import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { assemble } from "./assembly.mjs";
import { governance } from "./governance.mjs";

export function crewPaths(configDir, runId) {
  const root = join(configDir, "fabric", "crew-launch");
  return { roster: join(root, `${runId}-roster.json`), config: join(root, `${runId}.json`) };
}

export function parseRepository(value) {
  const parts = value.trim().split("/");
  if (parts.length !== 2 || parts.some(part => !part)) {
    throw new Error(`Unable to resolve GitHub repository from: ${value}`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export async function resolveRepository(pi, cwd, signal) {
  const result = await pi.exec("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { cwd, signal, timeout: 15_000 });
  if (result.code !== 0) throw new Error(`Unable to resolve GitHub repository: ${result.stderr.trim()}`);
  return parseRepository(result.stdout);
}

export function queuedMessage(prepared) {
  return `Crew ${prepared.runId} is queued. Its terminal result or launch failure will be returned to this Pi session automatically.`;
}

export function launchCode(configPath) {
  return [
    `const cfg = JSON.parse(await pi.read(${JSON.stringify(configPath)}));`,
    "let roster = JSON.parse(await pi.read(cfg.rosterFile));",
    "if (roster.status !== 'queued') return { runId: cfg.runId, topic: cfg.topic, leadId: roster.lead?.actorId, status: roster.status, alreadyLaunched: true };",
    "try { await pi.edit({ path: cfg.rosterFile, oldText: '\"status\": \"queued\"', newText: '\"status\": \"launching\"' }); } catch {",
    "  roster = JSON.parse(await pi.read(cfg.rosterFile));",
    "  return { runId: cfg.runId, topic: cfg.topic, leadId: roster.lead?.actorId, status: roster.status, alreadyLaunched: true };",
    "}",
    "let lead; let members = [];",
    "try {",
    "  roster = JSON.parse(await pi.read(cfg.rosterFile)); roster.batchStartedAt = new Date().toISOString(); await pi.write({ path: cfg.rosterFile, text: JSON.stringify(roster, null, 2) });",
    "  const createdActors = await agents.createMany({ actors: [...cfg.members, cfg.lead] });",
    "  members = createdActors.slice(0, -1).map((actor, index) => ({ definition: cfg.members[index], actor }));",
    "  lead = createdActors.at(-1);",
    "  roster = JSON.parse(await pi.read(cfg.rosterFile));",
    "  roster.lead = { name: lead.name, actorId: lead.id };",
    "  roster.members = members.map(({ definition, actor }) => ({ name: actor.name, actorId: actor.id, role: definition.role }));",
    "  roster.status = 'started'; roster.batchCreatedAt = new Date().toISOString(); roster.leadWokenAt = new Date().toISOString();",
    "  await pi.write({ path: cfg.rosterFile, text: JSON.stringify(roster, null, 2) });",
    "  await agents.tell({ id: lead.id, message: cfg.assignment });",
    "  return { runId: cfg.runId, topic: cfg.topic, leadId: lead.id, status: 'started', memberIds: members.map(member => member.actor.id) };",
    "} catch (error) {",
    "  roster = JSON.parse(await pi.read(cfg.rosterFile));",
    "  roster = JSON.parse(await pi.read(cfg.rosterFile));",
    "  if (roster.status === 'closed') return { runId: cfg.runId, topic: cfg.topic, leadId: roster.lead?.actorId, status: 'closed' };",
    "  roster.status = 'failed'; roster.launchError = String(error);",
    "  await pi.write({ path: cfg.rosterFile, text: JSON.stringify(roster, null, 2) });",
    "  const actorIds = new Set([lead?.id, roster.lead?.actorId, ...members.map(member => member.actor.id), ...(roster.members || []).map(member => member.actorId)].filter(Boolean));",
    "  try { for (const actor of await agents.actors()) if (actor.topics?.includes(cfg.topic)) actorIds.add(actor.id); } catch {}",
    "  const removedIds = new Set(); const cleanupFailures = [];",
    "  for (const id of actorIds) { try { const result = await agents.remove({ id }); if (result?.removed) removedIds.add(id); else cleanupFailures.push({ actorId: id, error: 'remove not confirmed' }); } catch (cleanupError) { if (String(cleanupError).includes('Unknown Fabric actor')) removedIds.add(id); else cleanupFailures.push({ actorId: id, error: String(cleanupError) }); } }",
    "  try {",
    "    roster = JSON.parse(await pi.read(cfg.rosterFile));",
    "    roster.members = (roster.members || []).filter(member => !removedIds.has(member.actorId));",
    "    if (roster.lead?.actorId && removedIds.has(roster.lead.actorId)) roster.leadRemoved = true;",
    "    roster.cleanupFailures = cleanupFailures; roster.cleanedActorIds = [...removedIds];",
    "    await pi.write({ path: cfg.rosterFile, text: JSON.stringify(roster, null, 2) });",
    "  } catch {}",
    "  throw error;",
    "}",
  ].join("\n");
}

export async function prepareCrew(pi, input, ctx, configDir) {
  if (Boolean(input.discussionNumber) !== Boolean(input.discussionUrl)) {
    throw new Error("discussionNumber and discussionUrl must be provided together");
  }
  if (String(input.task || "").trim().length > 8000) throw new Error("Crew task exceeds 8000 characters");
  if (input.resultSummaryMaxBytes !== undefined && (!Number.isInteger(input.resultSummaryMaxBytes) || input.resultSummaryMaxBytes < 512 || input.resultSummaryMaxBytes > 50000)) throw new Error("resultSummaryMaxBytes must be an integer from 512 to 50000");
  const runId = crypto.randomUUID();
  const topic = `crew.${runId}`;
  const completionMode = input.completionMode === "human-gated" ? "human-gated" : "unattended";
  const leadTickTopic = `${topic}.lead-tick`;
  const monitorIntervalMs = input.monitorIntervalMs ?? 600_000;
  const paths = crewPaths(configDir, runId);
  const absoluteRoster = join(ctx.cwd, paths.roster);
  const repository = await resolveRepository(pi, ctx.cwd, ctx.signal);
  const seenMembers = new Set();
  for (const member of input.members) {
    if (!member.name?.trim() || !member.role?.trim()) throw new Error("Crew members require name and role.");
    const identity = `${member.role}-${member.name}`;
    if (seenMembers.has(identity)) throw new Error(`Duplicate Crew member: ${identity}`);
    seenMembers.add(identity);
  }
  const members = input.members.map(member => ({
    ...assemble(member.name, member.role, "", { runtimeTools: pi.getAllTools() }), role: member.role, runner: "pi", extensions: true,
    topics: [topic], responseMode: "text", delivery: "steer", triggerTurn: false, residency: "durable",
  }));
  const assignment = `${input.task}\n${governance({ topic, runId, members, discussionNumber: input.discussionNumber, discussionUrl: input.discussionUrl, completionMode, leadTickTopic })}`;
  const lead = {
    ...assemble("old-major", "lead", "", input), runner: "pi", extensions: true,
    topics: completionMode === "human-gated" ? [topic, leadTickTopic] : [topic],
    ...(completionMode === "human-gated" ? { schedule: { topic: leadTickTopic, everyMs: monitorIntervalMs } } : {}),
    responseMode: "text", delivery: "followUp", triggerTurn: true, residency: "durable",
  };
  const absoluteConfig = join(ctx.cwd, paths.config);
  mkdirSync(dirname(absoluteRoster), { recursive: true });
  try {
    writeFileSync(absoluteRoster, JSON.stringify({ runId, topic, status: "queued", preparedAt: new Date().toISOString(), resultSummaryMaxBytes: input.resultSummaryMaxBytes ?? null, completionMode, leadTickTopic: completionMode === "human-gated" ? leadTickTopic : null, monitorIntervalMs: completionMode === "human-gated" ? monitorIntervalMs : null, ...repository, discussionNumber: input.discussionNumber ?? null, discussionUrl: input.discussionUrl ?? null, outputPath: input.outputPath ?? null, members: [] }, null, 2));
    writeFileSync(absoluteConfig, JSON.stringify({ runId, topic, rosterFile: paths.roster, members, lead, assignment, launch: launchCode(absoluteConfig) }));
  } catch (error) {
    rmSync(absoluteRoster, { force: true }); rmSync(absoluteConfig, { force: true }); throw error;
  }
  return { runId, topic, rosterFile: paths.roster, configFile: paths.config };
}
