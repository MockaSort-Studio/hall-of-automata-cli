// Minimal stand-in for worker.mjs used by lifecycle status tests. Never
// spawns a real `pi` process; only exercises LifecycleController's process
// lifecycle (spawn/kill/exit) cheaply and deterministically.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configPath = resolve(process.argv[2]);
const config = JSON.parse(readFileSync(configPath, "utf8"));

if (config.task === "FAIL") process.exit(1);
if (config.task === "SLEEP") setInterval(() => {}, 1_000);
// Default: exit success immediately, simulating a completed worker.
