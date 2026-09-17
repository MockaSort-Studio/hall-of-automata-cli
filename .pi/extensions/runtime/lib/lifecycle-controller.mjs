import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const GIT_TIMEOUT = 30_000;
const runGit = (cwd, args) =>
  exec("git", args, { cwd, timeout: GIT_TIMEOUT, killSignal: "SIGKILL", maxBuffer: 64 * 1024 });
const waitForExit = (child, ms) =>
  new Promise((resolve) => {
    if (child.exitCode !== null) return resolve(true);
    const timer = setTimeout(() => resolve(false), ms);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

export class LifecycleController {
  #agents = new Map();
  constructor({ cwd, sdkModule, workerModule }) {
    this.cwd = cwd;
    this.sdkModule = sdkModule;
    this.workerModule = workerModule;
  }
  async spawn(config) {
    const id = config.actorId ?? randomUUID();
    if (this.#agents.has(id)) throw new Error(`SDK actor already exists: ${id}`);
    const root = join(this.cwd, ".pi", "runtime", "runs", id),
      worktree = join(root, "worktree"),
      configFile = join(root, "worker.json"),
      logFile = join(root, "events.jsonl");
    let worktreeAdded = false,
      child;
    try {
      await mkdir(root, { recursive: true });
      await runGit(this.cwd, ["worktree", "add", "--detach", worktree, "HEAD"]);
      worktreeAdded = true;
      const patch = await exec("git", ["diff", "--binary", "HEAD"], { cwd: this.cwd, maxBuffer: 4 * 1024 * 1024 });
      if (patch.stdout) {
        const patchFile = join(root, "working-tree.patch");
        await writeFile(patchFile, patch.stdout);
        await exec("git", ["apply", patchFile], { cwd: worktree, timeout: GIT_TIMEOUT });
      }
      const untracked = await exec("git", ["ls-files", "--others", "--exclude-standard"], { cwd: this.cwd });
      await Promise.all([
        ...untracked.stdout
          .split("\n")
          .filter(Boolean)
          .map((path) => cp(join(this.cwd, path), join(worktree, path), { recursive: true })),
        cp(join(this.cwd, ".pi", "extensions"), join(worktree, ".pi", "extensions"), { recursive: true }),
      ]);
      await writeFile(
        configFile,
        JSON.stringify({
          cwd: worktree,
          extensionCwd: this.cwd,
          task: config.task,
          model: config.model,
          thinking: config.thinking,
          tools: config.tools,
          extensionPaths: config.extensionPaths,
          comm: config.comm,
          delivery: config.delivery,
          resident: config.resident,
          initialTurn: config.initialTurn,
          crewMembers: config.crewMembers,
          crewLead: config.crewLead,
          logFile,
          sdkModule: this.sdkModule,
        }),
      );
      child = (await import("node:child_process")).spawn(process.execPath, [this.workerModule, configFile], {
        cwd: worktree,
        detached: true,
        stdio: "ignore",
        env: { ...process.env, PI_FABRIC_ACTOR_ID: "", PI_SDK_ACTOR_ID: id, PI_CREW_ROOT: this.cwd },
      });
      await new Promise((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
      child.unref();
      const agent = { id, name: config.name, pid: child.pid, worktree, status: "running" };
      Object.defineProperty(agent, "child", { value: child });
      this.#agents.set(id, agent);
      child.once("exit", (code, signal) => {
        agent.status = code === 0 ? "completed" : "failed";
        agent.exitCode = code;
        agent.signal = signal;
      });
      return agent;
    } catch (error) {
      if (child?.pid)
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      if (worktreeAdded) await runGit(this.cwd, ["worktree", "remove", "--force", worktree]).catch(() => {});
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  }
  async list() {
    return [...this.#agents.values()];
  }
  async inspect(id) {
    const agent = this.#agents.get(id);
    if (!agent) return { id, found: false };
    const path = join(this.cwd, ".pi", "runtime", "runs", id, "events.jsonl");
    const events = await readFile(path, "utf8")
      .then((text) =>
        text
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean),
      )
      .catch(() => []);
    return { ...agent, found: true, events: events.length };
  }
  async remove(id) {
    const agent = this.#agents.get(id);
    if (!agent) return { id, removed: false };
    agent.status = "stopping";
    try {
      process.kill(-agent.pid, "SIGTERM");
    } catch {}
    if (!(await waitForExit(agent.child, 5_000)))
      try {
        process.kill(-agent.pid, "SIGKILL");
      } catch {}
    await runGit(this.cwd, ["worktree", "remove", "--force", agent.worktree]);
    await rm(join(this.cwd, ".pi", "runtime", "runs", id), { recursive: true, force: true });
    this.#agents.delete(id);
    return { id, removed: true };
  }
  async shutdown() {
    const agents = await this.list();
    return Promise.allSettled(agents.map((agent) => this.remove(agent.id)));
  }
}
