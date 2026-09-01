import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { assemble } from "./assembly.mjs";
import { governance } from "./governance.mjs";

export function crewPaths(configDir, runId) {
  const root = join(configDir, "fabric", "crew-launch");
  return {
    roster: join(root, `${runId}-roster.json`),
    config: join(root, `${runId}.json`),
  };
}

export function parseRepository(value) {
  const nameWithOwner = value.trim();
  const parts = nameWithOwner.split("/");
  if (parts.length !== 2 || parts.some(part => !part)) {
    throw new Error(`Unable to resolve GitHub repository from: ${value}`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export async function resolveRepository(pi, cwd, signal) {
  const result = await pi.exec(
    "gh",
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    { cwd, signal, timeout: 15_000 },
  );
  if (result.code !== 0) {
    throw new Error(`Unable to resolve GitHub repository: ${result.stderr.trim()}`);
  }
  return parseRepository(result.stdout);
}

export function launchCode(configPath) {
  return [
    `const cfg = JSON.parse(await pi.read(${JSON.stringify(configPath)}));`,
    "let lead;",
    "try {",
    "  lead = await agents.create(cfg.lead);",
    "  const roster = JSON.parse(await pi.read(cfg.rosterFile));",
    "  roster.lead = { name: lead.name, actorId: lead.id, role: 'lead' };",
    "  roster.status = 'starting';",
    "  await pi.write({ path: cfg.rosterFile, content: JSON.stringify(roster, null, 2) });",
    "  await agents.followUp({ id: lead.id, message: 'Begin the work in your initial assignment.' });",
    "  roster.status = 'started';",
    "  await pi.write({ path: cfg.rosterFile, content: JSON.stringify(roster, null, 2) });",
    "  return { runId: cfg.runId, topic: cfg.topic, leadId: lead.id, status: 'started' };",
    "} catch (error) {",
    "  const roster = JSON.parse(await pi.read(cfg.rosterFile));",
    "  roster.status = 'failed';",
    "  roster.launchError = String(error);",
    "  await pi.write({ path: cfg.rosterFile, content: JSON.stringify(roster, null, 2) });",
    "  if (lead) { try { await agents.remove({ id: lead.id }); } catch {} }",
    "  throw error;",
    "}",
  ].join("\n");
}

export async function prepareCrew(pi, input, ctx, configDir) {
  if (Boolean(input.discussionNumber) !== Boolean(input.discussionUrl)) {
    throw new Error("discussionNumber and discussionUrl must be provided together");
  }
  const runId = crypto.randomUUID();
  const topic = `crew.${runId}`;
  const paths = crewPaths(configDir, runId);
  const absoluteRoster = join(ctx.cwd, paths.roster);
  const repository = await resolveRepository(pi, ctx.cwd, ctx.signal);
  const assignment = `${input.task}\n${governance({
    topic,
    runId,
    rosterFile: paths.roster,
    outputPath: input.outputPath,
    discussionNumber: input.discussionNumber,
    discussionUrl: input.discussionUrl,
  })}`;
  const member = assemble("old-major", "lead", assignment, input);
  const lead = {
    ...member,
    runner: "pi",
    extensions: true,
    topics: [topic],
    responseMode: "text",
    delivery: "mailbox",
    residency: "durable",
  };
  const absoluteConfig = join(ctx.cwd, paths.config);
  mkdirSync(dirname(absoluteRoster), { recursive: true });
  try {
    writeFileSync(absoluteRoster, JSON.stringify({
      runId,
      topic,
      status: "queued",
      ...repository,
      discussionNumber: input.discussionNumber ?? null,
      discussionUrl: input.discussionUrl ?? null,
      outputPath: input.outputPath ?? null,
      members: [],
    }, null, 2));
    writeFileSync(absoluteConfig, JSON.stringify({
      runId,
      topic,
      rosterFile: paths.roster,
      lead,
    }));
  } catch (error) {
    rmSync(absoluteRoster, { force: true });
    rmSync(absoluteConfig, { force: true });
    throw error;
  }
  return { runId, topic, rosterFile: paths.roster, configFile: paths.config };
}
