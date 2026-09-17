import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveBundles } from "./tool-bundles.mjs";
import { connectComm } from "./comm-client.mjs";
import { connectLifecycle } from "./lifecycle-client.mjs";

const defaultTools = ["read", "bash", "edit", "write", "grep", "find", "ls"];

export class Runtime {
  #comm;
  #commUrl;
  #commProcess;
  #mainDeliveries = [];
  #lifecycle;
  #lifecycleProcess;

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

  async #ensureLifecycle() {
    if (this.#lifecycle) return;
    const config = JSON.stringify({
      cwd: this.cwd,
      sdkModule: this.sdkModule,
      workerModule: join(import.meta.dirname, "worker.mjs"),
    });
    this.#lifecycleProcess = spawn(process.execPath, [join(import.meta.dirname, "lifecycle-server.mjs"), config], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const line = await new Promise((resolve, reject) => {
      this.#lifecycleProcess.stdout.once("data", (data) => resolve(String(data)));
      this.#lifecycleProcess.once("error", reject);
    });
    const { port } = JSON.parse(line);
    this.#lifecycle = await connectLifecycle(`ws://127.0.0.1:${port}`);
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
      this.#comm.onDelivery((message) => this.#mainDeliveries.push(message));
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
    if (actorId === "main" && this.#mainDeliveries.length) {
      const message = this.#mainDeliveries.shift();
      await this.#comm.acknowledge(message.id);
      return message;
    }
    return (await this.#comm.claim(actorId)) ?? null;
  }

  async inspectComm() {
    if (!this.#comm) throw new Error("Communication controller is not running");
    return this.#comm.inspect();
  }

  async launchCrew(agents) {
    const actorIds = agents.map((agent) => agent.actorId).filter(Boolean);
    if (new Set(actorIds).size !== actorIds.length) throw new Error("Crew agent actor IDs must be unique.");
    const comm = await this.startComm(actorIds);
    const launched = [];
    try {
      for (const agent of agents) launched.push(await this.spawn(agent));
      return { comm, agents: launched };
    } catch (error) {
      await Promise.allSettled(launched.map((agent) => this.remove(agent.id)));
      throw error;
    }
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
    initialTurn = "startup",
    namespace,
    crewMembers,
    crewLead,
  }) {
    await this.#ensureLifecycle();
    const bundle = resolveBundles(this.cwd, bundles);
    tools = [...new Set([...tools, ...bundle.tools])];
    extensionPaths = [...new Set([...extensionPaths, ...bundle.extensionPaths])];
    const id = actorId ?? randomUUID();
    if (this.#comm) await this.#comm.registerActor(id);
    const delivery = this.#comm ? await this.#comm.claim(id) : undefined;
    return this.#lifecycle.spawn({
      name,
      task,
      actorId: id,
      model,
      thinking,
      tools,
      extensionPaths,
      comm: comm ?? (this.#commUrl && id ? { url: this.#commUrl, actorId: id, namespace } : undefined),
      delivery,
      resident,
      initialTurn,
      crewMembers,
      crewLead,
    });
  }

  async list() {
    await this.#ensureLifecycle();
    return this.#lifecycle.list();
  }

  async inspect(id) {
    await this.#ensureLifecycle();
    return this.#lifecycle.inspect(id);
  }

  async remove(id) {
    await this.#ensureLifecycle();
    return this.#lifecycle.remove(id);
  }

  async stop() {
    const agents = this.#lifecycle ? await this.list() : [];
    const removals = await Promise.allSettled(agents.map((agent) => this.remove(agent.id)));
    this.#lifecycle?.close();
    this.#comm?.close();
    if (this.#lifecycleProcess?.pid) {
      try {
        process.kill(this.#lifecycleProcess.pid, "SIGTERM");
      } catch {}
    }
    if (this.#commProcess?.pid) {
      try {
        process.kill(this.#commProcess.pid, "SIGTERM");
      } catch {}
    }
    this.#lifecycle = undefined;
    this.#comm = undefined;
    this.#lifecycleProcess = undefined;
    this.#commProcess = undefined;
    this.#commUrl = undefined;
    this.#mainDeliveries = [];
    return {
      removals: removals.map((result) =>
        result.status === "fulfilled" ? result.value : { removed: false, error: String(result.reason) },
      ),
    };
  }
}
