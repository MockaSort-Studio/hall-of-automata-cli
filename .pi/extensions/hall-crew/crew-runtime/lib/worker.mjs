import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { boundedText, mapWorkerEvent } from "./worker-events.mjs";
import { resolveArmoryCatalogReference } from "../../env-runtime/lib/armory-catalog-reference.mjs";
import { acquireNixGuestSuites } from "../../env-runtime/lib/nix-guest-suite-acquisition.mjs";
import { CREDENTIAL_LEASE_ENV, issueCredentialLease } from "../../env-runtime/lib/credential-lease.mjs";

const configPath = resolve(process.argv[2]);
const config = JSON.parse(readFileSync(configPath, "utf8"));

async function prepareArmory(config) {
  if (!Array.isArray(config.armory?.tools) || !config.armory.tools.length) return undefined;
  const catalog = await resolveArmoryCatalogReference(config.armory.catalog);
  const suites = await acquireNixGuestSuites({ catalog, tools: config.armory.tools });
  const credentials = new Map();
  const allowedHosts = new Set();
  for (const suite of suites) {
    for (const host of suite.network?.allowedHosts ?? []) allowedHosts.add(host);
    for (const credential of suite.network?.credentials ?? []) {
      const existing = credentials.get(credential.environment);
      if (existing && JSON.stringify(existing.hosts) !== JSON.stringify(credential.hosts))
        throw new Error(`Conflicting Armory credential policy: ${credential.environment}`);
      credentials.set(credential.environment, credential);
    }
  }
  return {
    catalogRevision: catalog.revision,
    nixPaths: [...new Set(suites.flatMap((suite) => suite.paths))].sort(),
    suites: suites.map(({ suite, rootPath, tools }) => ({ suite, rootPath, tools })),
    network: { allowedHosts: [...allowedHosts].sort(), credentials: [...credentials.values()] },
  };
}

config.armory = await prepareArmory(config);
// The child Pi extensions read this same trusted worker config. Persist the
// prepared lease projection, never the mutable catalog channel, before Pi is
// spawned so they receive only exact paths and approved grants.
writeFileSync(configPath, JSON.stringify(config));
const startedAt = Date.now();
const boundedError = (value) => boundedText(value, 4000);
const log = (event) =>
  appendFileSync(config.logFile, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
const lifecycleTools = config.comm ? ["lifecycle_update"] : [];
const tools = [
  ...new Set([
    ...(config.tools ?? []),
    ...(config.commTools ?? ["comm_notify", "comm_request", "comm_reply"]),
    ...lifecycleTools,
  ]),
];
const args = [
  "--mode",
  "rpc",
  "--no-session",
  "--tools",
  tools.join(","),
  "--extension",
  resolve(import.meta.dirname, "worker-comm-extension.mjs"),
];
if (config.sandbox?.kind === "gondolin") {
  args.push(
    "--extension",
    resolve(config.extensionCwd, ".pi", "extensions", "hall-crew", "env-runtime", "lib", "worker-gondolin-extension.mjs"),
  );
  if (config.armory)
    args.push(
      "--extension",
      resolve(config.extensionCwd, ".pi", "extensions", "hall-crew", "env-runtime", "lib", "armory-worker-proxy-extension.mjs"),
    );
}
for (const extensionPath of config.extensionPaths ?? []) args.push("--extension", resolve(config.cwd, extensionPath));
if (config.model) args.push("--model", config.model);
if (config.thinking) args.push("--thinking", config.thinking);
// Credential values never enter worker.json. Source a fresh, host-held lease
// for this worker, remove the raw variables, and hand the child Pi only the
// lease consumed by the Gondolin extension.
const credentialLease = issueCredentialLease(config.armory?.network);
const child = spawn("pi", args, {
  cwd: config.cwd,
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    PI_CREW_WORKER_CONFIG: configPath,
    [CREDENTIAL_LEASE_ENV]: JSON.stringify(credentialLease),
  },
});
let buffer = "";
let startupSent = false;
const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
const startsPrompt = !config.resident || config.delivery || config.initialTurn === "startup";
const sendStartupPrompt = () => {
  if (!startsPrompt || startupSent) return;
  startupSent = true;
  const delivery = config.delivery
    ? `\n\nCommunication delivery: ${JSON.stringify({ from: config.delivery.from, payload: config.delivery.payload, replyRequired: Boolean(config.delivery.replyRequired) })}`
    : "";
  send({ id: "initial", type: "prompt", message: `${config.task}${delivery}` });
};
child.stdout.on("data", (chunk) => {
  buffer += String(chunk);
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).replace(/\r$/, "");
    buffer = buffer.slice(newline + 1);
    try {
      const message = JSON.parse(line);
      if (message.type === "response" && message.id === "worker-session") {
        log({ type: "worker_session", success: message.success });
        if (message.success) sendStartupPrompt();
      }
      const entry = mapWorkerEvent(message);
      if (entry) log(entry);
    } catch {}
  }
});
child.stderr.on("data", (chunk) => log({ type: "agent_error", message: boundedError(chunk) }));
child.once("error", (error) => log({ type: "agent_error", message: error.message }));
child.once("exit", (code, signal) => {
  log({ type: code === 0 ? "agent_end" : "agent_error", elapsedMs: Date.now() - startedAt, code, signal });
  process.exitCode = code ?? 1;
});
// Pi RPC installs its stdin reader asynchronously; writing immediately after
// spawn can lose this first command. Match the SDK client's startup guard.
setTimeout(() => {
  if (config.resident) send({ id: "worker-session", type: "new_session" });
  else sendStartupPrompt();
}, 100);
process.once("SIGTERM", () => child.kill("SIGTERM"));
