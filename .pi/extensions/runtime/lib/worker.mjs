import { spawn } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { boundedText, mapWorkerEvent } from "./worker-events.mjs";

const configPath = resolve(process.argv[2]);
const config = JSON.parse(readFileSync(configPath, "utf8"));
const startedAt = Date.now();
const boundedError = (value) => boundedText(value, 4000);
const log = (event) =>
  appendFileSync(config.logFile, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
const tools = [
  ...new Set([...(config.tools ?? []), ...(config.commTools ?? ["comm_notify", "comm_request", "comm_reply"])]),
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
if (config.model) args.push("--model", config.model);
if (config.thinking) args.push("--thinking", config.thinking);
const child = spawn("pi", args, {
  cwd: config.cwd,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PI_CREW_WORKER_CONFIG: configPath },
});
let buffer = "";
const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
child.stdout.on("data", (chunk) => {
  buffer += String(chunk);
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).replace(/\r$/, "");
    buffer = buffer.slice(newline + 1);
    try {
      const entry = mapWorkerEvent(JSON.parse(line));
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
if (!config.resident || config.delivery || config.initialTurn === "startup") {
  const delivery = config.delivery
    ? `\n\nCommunication delivery: ${JSON.stringify({ from: config.delivery.from, payload: config.delivery.payload, replyRequired: Boolean(config.delivery.replyRequired) })}`
    : "";
  send({ id: "initial", type: "prompt", message: `${config.task}${delivery}` });
}
if (config.resident && config.initialTurn === "first-delivery") send({ type: "new_session" });
process.once("SIGTERM", () => child.kill("SIGTERM"));
