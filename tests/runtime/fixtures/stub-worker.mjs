// Minimal stand-in for worker.mjs used by lifecycle status tests. Never
// spawns a real `pi` process; only exercises LifecycleController's process
// lifecycle (spawn/kill/exit) cheaply and deterministically.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const configPath = resolve(process.argv[2]);
const config = JSON.parse(readFileSync(configPath, "utf8"));

if (config.task === "FAIL") process.exit(1);
if (config.task === "SLEEP") setInterval(() => {}, 1_000);
// Dumps the worker's own environment so isolation tests can assert which
// host-discovery variables (if any) a spawned worker actually receives.
if (config.task === "DUMP_ENV") writeFileSync(join(config.cwd, "env.json"), JSON.stringify(process.env));
if (config.task === "TURN") {
  appendFileSync(
    config.logFile,
    `${JSON.stringify({ type: "turn", usage: { input: 10, output: 5, cacheRead: 90, cacheWrite: 0, totalTokens: 105 } })}\n`,
  );
}
// Default: exit success immediately, simulating a completed worker.
