#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { summarizeWorkerEvents } from "../.pi/extensions/runtime/lib/worker-metrics.mjs";

const root = process.cwd();
const launch = join(root, ".pi", "runtime", "crew-launch");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const events = (path) =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
const rosterFiles = () =>
  existsSync(launch) ? readdirSync(launch).filter((name) => name.endsWith("-roster.json")) : [];
const requested = process.argv[2];
const file = rosterFiles()
  .map((name) => join(launch, name))
  .map((path) => ({ path, roster: read(path) }))
  .filter(({ roster }) => !requested || roster.runId === requested || roster.runId.startsWith(requested))
  .sort((a, b) => b.roster.runId.localeCompare(a.roster.runId))[0];
if (!file) {
  console.error("No matching Crew roster.");
  process.exitCode = 1;
} else {
  const { roster } = file;
  console.log(`Crew ${roster.runId} · ${roster.status}`);
  console.log("automaton                         turns  tools  errors  output   cache read  max cache");
  for (const member of roster.members ?? []) {
    const path = join(root, ".pi", "runtime", "runs", member.actorId, "events.jsonl");
    const metric = summarizeWorkerEvents(events(path));
    console.log(
      `${member.name.padEnd(33)} ${String(metric.turns).padStart(5)} ${String(metric.toolCalls).padStart(6)} ${String(metric.toolErrors).padStart(7)} ${String(metric.providerTraffic.generatedOutput).padStart(7)} ${String(metric.providerTraffic.cacheRead).padStart(12)} ${String(metric.providerTraffic.maxCacheReadPerTurn).padStart(8)}`,
    );
  }
}
