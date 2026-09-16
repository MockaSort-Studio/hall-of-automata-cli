import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const defaultTools = ["read", "bash", "edit", "write", "grep", "find", "ls"];

export class Runtime {
  #agents = new Map();

  constructor(cwd, sdkModule) {
    this.cwd = cwd;
    this.sdkModule = sdkModule;
  }

  spawn({ name, task, model, thinking = "off", tools = defaultTools, extensionPaths = [] }) {
    const id = randomUUID();
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
