import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveBundles } from "./tool-bundles.mjs";
import { connectComm } from "./comm-client.mjs";

const defaultTools = ["read", "bash", "edit", "write", "grep", "find", "ls"];

export class Runtime {
  #agents = new Map();
  #comm;
  #commUrl;
  #commProcess;

  constructor(cwd, sdkModule = process.env.PI_SDK_MODULE) {
    this.cwd = cwd;
    this.sdkModule =
      sdkModule ??
      pathToFileURL(
        join(
          dirname(dirname(process.execPath)),
          "lib",
          "node_modules",
          "@earendil-works",
          "pi-coding-agent",
          "dist",
          "index.js",
        ),
      ).href;
  }

  async startComm(actorIds = []) {
    if (!this.#comm) {
      this.#commProcess = spawn(process.execPath, [join(import.meta.dirname, "comm-server.mjs")], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      const line = await new Promise((resolve, reject) => {
        this.#commProcess.stdout.once("data", (data) => resolve(String(data)));
        this.#commProcess.once("error", reject);
      });
      const { port } = JSON.parse(line);
      this.#commUrl = `ws://127.0.0.1:${port}`;
      this.#comm = await connectComm({ url: this.#commUrl, actorId: "main" });
    }
    await Promise.all(actorIds.map((actorId) => this.#comm.registerActor(actorId)));
    return { url: this.#commUrl };
  }

  async send(to, payload) {
    if (!this.#comm) throw new Error("Communication controller is not running");
    return this.#comm.emit({ to, payload });
  }

  async receive(actorId = "main") {
    if (!this.#comm) throw new Error("Communication controller is not running");
    return (await this.#comm.claim(actorId)) ?? null;
  }

  async inspectComm() {
    if (!this.#comm) throw new Error("Communication controller is not running");
    return this.#comm.inspect();
  }

  async spawn({
    name,
    task,
    actorId,
    model,
    thinking = "off",
    tools = defaultTools,
    extensionPaths = [],
    bundles = [],
    comm,
    resident = false,
  }) {
    const bundle = resolveBundles(this.cwd, bundles);
    tools = [...new Set([...tools, ...bundle.tools])];
    extensionPaths = [...new Set([...extensionPaths, ...bundle.extensionPaths])];
    const id = actorId ?? randomUUID();
    if (this.#comm) await this.#comm.registerActor(id);
    const root = join(this.cwd, ".pi", "runtime", "runs", id);
    const worktree = join(root, "worktree");
    mkdirSync(root, { recursive: true });
    const added = spawnSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], {
      cwd: this.cwd,
      encoding: "utf8",
    });
    if (added.status !== 0) throw new Error(added.stderr || "Could not create worktree");
    const logFile = join(root, "events.jsonl");
    const configFile = join(root, "worker.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        cwd: worktree,
        extensionCwd: this.cwd,
        task,
        model,
        thinking,
        tools,
        extensionPaths,
        comm: comm ?? (this.#commUrl ? { url: this.#commUrl, actorId: id } : undefined),
        delivery: this.#comm ? await this.#comm.claim(id) : undefined,
        resident,
        logFile,
        sdkModule: this.sdkModule,
      }),
    );
    const child = spawn(process.execPath, [join(import.meta.dirname, "worker.mjs"), configFile], {
      cwd: worktree,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    const agent = { id, name, pid: child.pid, worktree, status: "running" };
    this.#agents.set(id, agent);
    child.once("exit", (code, signal) => {
      agent.status = code === 0 ? "completed" : "failed";
      agent.exitCode = code;
      agent.signal = signal;
    });
    return agent;
  }

  list() {
    return [...this.#agents.values()];
  }

  inspect(id) {
    const agent = this.#agents.get(id);
    if (!agent) return { id, found: false };
    const events = existsSync(join(this.cwd, ".pi", "runtime", "runs", id, "events.jsonl"))
      ? readFileSync(join(this.cwd, ".pi", "runtime", "runs", id, "events.jsonl"), "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map(JSON.parse)
      : [];
    const starts = events.filter((event) => event.type === "tool_start");
    const tools = events.filter((event) => event.type === "tool_end");
    const turns = events.filter((event) => event.type === "turn");
    const startup = events.find((event) => event.type === "agent_start");
    const outcome = events.findLast((event) => event.type === "agent_end" || event.type === "agent_error");
    return {
      ...agent,
      found: true,
      events: events.length,
      tools: Object.groupBy(tools, (event) => event.source),
      usage: turns.at(-1)?.usage,
      context: turns.at(-1)?.context,
      outcome: outcome?.type,
      ledger: {
        systemTokens: startup?.systemTokens,
        toolSchemaTokens: startup?.toolSchemaTokens,
        toolCallTokens: starts.reduce((sum, event) => sum + event.callTokens, 0),
        toolResultTokens: tools.reduce((sum, event) => sum + event.resultTokens, 0),
        wallMs: outcome?.elapsedMs,
      },
    };
  }

  remove(id) {
    const agent = this.#agents.get(id);
    if (!agent) return { id, removed: false };
    try {
      process.kill(-agent.pid, "SIGTERM");
    } catch {}
    spawnSync("git", ["worktree", "remove", "--force", agent.worktree], { cwd: this.cwd });
    rmSync(join(this.cwd, ".pi", "runtime", "runs", id), { recursive: true, force: true });
    this.#agents.delete(id);
    return { id, removed: true };
  }
}
