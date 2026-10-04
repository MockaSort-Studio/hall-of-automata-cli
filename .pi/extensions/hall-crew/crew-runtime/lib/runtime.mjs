import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp } from "node:fs/promises";
import { join } from "node:path";
import { resolveBundles } from "./tool-bundles.mjs";
import { connectComm } from "./comm-client.mjs";
import { connectLifecycle } from "./lifecycle-client.mjs";
import { reapOrphans, recordOwner, removeOwner } from "./lifecycle-registry.mjs";
import { createCrewTerminalNotifier } from "./crew-terminal-notifier.mjs";
import { createMainDeliveryNotifier } from "./main-delivery-notifier.mjs";
import { createDependentRelease } from "./dependent-release.mjs";
import { isLead, leadBriefing } from "./lead-briefing.mjs";

const defaultTools = ["read", "bash", "edit", "write", "grep", "find", "ls"];
const stopProcess = async (child) => {
  if (!child?.pid || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    process.kill(child.pid, "SIGTERM");
  } catch {}
  if (await Promise.race([exited.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 5_000))]))
    return;
  try {
    process.kill(child.pid, "SIGKILL");
  } catch {}
  await exited;
};

export class Runtime {
  #comm;
  #commUrl;
  #commProcess;
  #commAuthToken;
  #mainDeliveries = [];
  #mainNotifier;
  #mainInbox = new Map();
  #plans = new Map();
  #dispatches = new Map();
  #lifecycle;
  #lifecycleProcess;
  #lifecycleAuthToken;
  #terminalNotifier;
  #stateUnsubscribers = new Map();
  #releaseUnsubscribers = new Map();

  constructor(cwd) {
    this.cwd = cwd;
  }

  async #ensureLifecycle() {
    if (this.#lifecycle) return;
    // Best-effort: reap Lifecycle servers left behind by a dead Main
    // session before starting a new one. Never blocks startup on failure.
    await reapOrphans(this.cwd).catch(() => {});
    this.#lifecycleAuthToken = randomUUID();
    const config = JSON.stringify({
      cwd: this.cwd,
      workerModule: join(import.meta.dirname, "worker.mjs"),
      authToken: this.#lifecycleAuthToken,
      hostPid: process.pid,
    });
    this.#lifecycleProcess = spawn(process.execPath, [join(import.meta.dirname, "lifecycle-server.mjs"), config], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const line = await new Promise((resolve, reject) => {
      this.#lifecycleProcess.stdout.once("data", (data) => resolve(String(data)));
      this.#lifecycleProcess.once("error", reject);
    });
    const { port } = JSON.parse(line);
    await recordOwner(this.cwd, { pid: this.#lifecycleProcess.pid, hostPid: process.pid, port }).catch(() => {});
    this.#lifecycle = await connectLifecycle(`ws://127.0.0.1:${port}`, { authToken: this.#lifecycleAuthToken });
  }

  // `plan` ({ namespace, members: [{handle, dependsOn, task}] }) is
  // optional and, when given, registered once with the Comm server so it
  // becomes the live owner of that run's dependency-ledger status (see
  // comm-state-owner.mjs) -- callers never need to reconstruct that DAG
  // themselves from raw envelopes.
  // With a Pi session attached, each Main delivery starts a turn instead of
  // waiting to be polled; it stays pending for reply/acknowledge either way.
  attachMainDelivery(sendMessage) {
    this.#mainNotifier = createMainDeliveryNotifier(sendMessage);
    return () => {
      this.#mainNotifier = undefined;
    };
  }

  #deliverToMain(message) {
    if (!this.#mainNotifier) return this.#mainDeliveries.push(message);
    this.#mainInbox.set(message.id, message);
    this.#mainNotifier(message);
  }

  attachTerminalNotifier(sendMessage) {
    this.#terminalNotifier = createCrewTerminalNotifier(sendMessage);
    return () => {
      this.#terminalNotifier = undefined;
      for (const unsubscribe of this.#stateUnsubscribers.values()) unsubscribe();
      this.#stateUnsubscribers.clear();
    };
  }

  async #observeTerminalState(namespace) {
    if (!this.#terminalNotifier || !this.#comm || this.#stateUnsubscribers.has(namespace)) return;
    const unsubscribe = this.#comm.observeState(namespace, (nodes, observedNamespace) =>
      this.#terminalNotifier?.observe({ namespace: observedNamespace, nodes }),
    );
    this.#stateUnsubscribers.set(namespace, unsubscribe);
    const initial = await this.#comm.getStateSnapshot(namespace);
    if (initial) this.#terminalNotifier.observe(initial);
  }

  async startComm(actors = [], adapters = [], plan) {
    if (!this.#comm) {
      this.#commProcess = spawn(
        process.execPath,
        [join(import.meta.dirname, "comm-server.mjs"), JSON.stringify({ adapters })],
        {
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      const line = await new Promise((resolve, reject) => {
        this.#commProcess.stdout.once("data", (data) => resolve(String(data)));
        this.#commProcess.once("error", reject);
      });
      const { port, authToken } = JSON.parse(line);
      this.#commAuthToken = authToken;
      this.#commUrl = `ws://127.0.0.1:${port}`;
      this.#comm = await connectComm({ url: this.#commUrl, actorId: "main", authToken });
      this.#comm.onDelivery((message) => this.#deliverToMain(message));
    }
    await Promise.all(
      actors.map((actor) =>
        typeof actor === "string" ? this.#comm.registerActor(actor) : this.#comm.registerActor(actor.actorId, actor.role),
      ),
    );
    if (plan?.namespace) {
      this.#plans.set(plan.namespace, plan.members ?? []);
      await this.#comm.registerPlan(plan.namespace, plan.members ?? []);
      await this.#observeTerminalState(plan.namespace);
    }
    return { url: this.#commUrl, authToken: this.#commAuthToken };
  }

  #memberId(runId, handle) {
    if (!/^[0-9a-f-]{36}$/i.test(runId) || !/^[a-z]+-[a-z0-9-]+-\d{2}$/i.test(handle))
      throw new Error("runId and member handle are required");
    return `crew-${runId}-${handle}`;
  }

  async send(to, payload) {
    if (!this.#comm) throw new Error("Communication controller is not running");
    return this.#comm.emit({ to, payload });
  }

  async sendMember(runId, to, payload) {
    return this.send(this.#memberId(runId, to), payload);
  }

  async request(runId, to, payload) {
    if (!this.#comm) throw new Error("Communication controller is not running");
    return this.#comm.emit({ to: this.#memberId(runId, to), payload, replyRequired: true });
  }

  async broadcastRun(runId, payload) {
    return this.broadcast(`crew-${runId}`, payload);
  }

  async dispatchRoots(runId, idempotencyKey) {
    if (!idempotencyKey || typeof idempotencyKey !== "string") throw new Error("Dispatch idempotencyKey is required");
    const namespace = `crew-${runId}`;
    const prior = this.#dispatches.get(namespace);
    if (prior?.key === idempotencyKey) return prior.result;
    if (prior) throw new Error("Initial Crew dispatch already exists");
    const members = this.#plans.get(namespace);
    if (!members) throw new Error("Unknown Crew dispatch plan");
    const lead = members.find(isLead);
    const initial = lead ? [lead] : members.filter((member) => !member.dependsOn?.length);
    const deliveries = await Promise.all(
      initial.map(async (member) => ({
        to: member.handle,
        ...(await this.sendMember(runId, member.handle, lead ? leadBriefing(runId, lead, members) : { kind: "task", phase: "assignment", runId, task: member.task })),
      })),
    );
    let held;
    if (lead) held = members.filter((member) => member !== lead).map((member) => member.handle);
    else {
      // Leadless: the Runtime releases each dependent when its prerequisites complete.
      const release = createDependentRelease({
        members,
        released: initial.map((member) => member.handle),
        send: (member) =>
          this.sendMember(runId, member.handle, { kind: "task", phase: "assignment", runId, task: member.task, prerequisites: member.dependsOn }),
      });
      await this.#releaseDependents(namespace, release);
      held = release.held();
    }
    const result = { dispatched: true, recipients: deliveries, held, ...(lead ? { leadLed: true } : {}) };
    this.#dispatches.set(namespace, { key: idempotencyKey, result });
    return result;
  }

  // After the roots are dispatched, each dependent receives its task the moment the
  // ledger marks it ready; the snapshot covers a prerequisite that already finished.
  async #releaseDependents(namespace, release) {
    const unsubscribe = this.#comm.observeState(namespace, (nodes) => release.observe(nodes).catch(() => {}));
    this.#releaseUnsubscribers.set(namespace, unsubscribe);
    const snapshot = await this.#comm.getStateSnapshot(namespace);
    if (snapshot) await release.observe(snapshot.nodes);
  }

  async broadcast(namespace, payload) {
    if (!this.#comm) throw new Error("Communication controller is not running");
    return this.#comm.broadcast({ namespace, payload });
  }

  async receive(actorId = "main") {
    if (!this.#comm) throw new Error("Communication controller is not running");
    if (actorId === "main" && this.#mainDeliveries.length) {
      const message = this.#mainDeliveries.shift();
      this.#mainInbox.set(message.id, message);
      return message;
    }
    return (await this.#comm.claim(actorId)) ?? null;
  }

  async acknowledgeMain(messageId) {
    const message = this.#mainInbox.get(messageId);
    if (!message) throw new Error("Unknown Main delivery");
    // Main deliveries are acknowledged by the broker on delivery; this only
    // retires the local pending entry.
    this.#mainInbox.delete(messageId);
    return { acknowledged: true };
  }

  async replyFromMain(messageId, payload) {
    const message = this.#mainInbox.get(messageId);
    if (!message) throw new Error("Unknown Main delivery");
    if (!message.replyRequired) throw new Error("Main delivery does not require a reply");
    const result = await this.#comm.emit({ to: message.from, payload, replyTo: message.id });
    await this.acknowledgeMain(messageId);
    return result;
  }

  async inspectComm() {
    if (!this.#comm) throw new Error("Communication controller is not running");
    return this.#comm.inspect();
  }

  // Internal-facing, like CommController.observeRaw(): the full unfiltered
  // envelope stream over Main's own WS connection, for in-process observers
  // (e.g. the live dependency ledger behind the Crew dashboard) that must
  // stay current with kickoff/report activity across the whole Crew, not
  // only messages addressed to "main". A no-op unsubscribe when Comm is not
  // running yet (nothing to observe before startComm()).
  observeRawComm(handler) {
    if (!this.#comm) return () => {};
    return this.#comm.observeRaw(handler);
  }

  async launchCrew(agents, adapters = [], plan, { readyTimeoutMs = 30_000 } = {}) {
    const actorIds = agents.map((agent) => agent.actorId).filter(Boolean);
    if (new Set(actorIds).size !== actorIds.length) throw new Error("Crew agent actor IDs must be unique.");
    const members = Object.fromEntries(agents.map((agent) => [agent.name, agent.actorId]));
    const comm = await this.startComm(
      agents.map(({ actorId, role }) => ({ actorId, role })),
      adapters.map((adapter) => ({
        ...adapter,
        recipients: members,
        lead: agents.find((agent) => agent.role === "lead")?.actorId,
      })),
      plan,
    );
    const launched = [];
    try {
      for (const agent of agents) launched.push(await this.spawn(agent));
      if (plan?.namespace && agents.every((agent) => agent.resident))
        await this.#comm.waitReady(plan.namespace, actorIds, readyTimeoutMs);
      return { comm, agents: launched };
    } catch (error) {
      // Preserve worker evidence outside the run directory before rollback.
      await Promise.allSettled(
        launched.map((agent) =>
          cp(
            join(this.cwd, ".pi", "runtime", "runs", agent.id),
            join(this.cwd, ".pi", "runtime", "archive", agent.id),
            { recursive: true, force: true },
          ),
        ),
      );
      await Promise.allSettled(launched.map((agent) => this.remove(agent.id)));
      // A failed launch owns its servers unless another Crew still uses them.
      if (!(await this.list().catch(() => [])).length) await this.stop();
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
    commTools,
    extensionPaths = [],
    bundles = [],
    comm,
    delivery,
    resident = false,
    initialTurn = "startup",
    namespace,
    crewMembers,
    crewLead,
    sandbox,
    armory,
  }) {
    await this.#ensureLifecycle();
    const bundle = resolveBundles(this.cwd, bundles);
    tools = [...new Set([...tools, ...bundle.tools])];
    extensionPaths = [...new Set([...extensionPaths, ...bundle.extensionPaths])];
    const id = actorId ?? randomUUID();
    if (this.#comm) await this.#comm.registerActor(id);
    // The worker claims its own mailbox after its authenticated Comm socket
    // connects. Main must not claim a worker mailbox on its behalf.
    return this.#lifecycle.spawn({
      name,
      task,
      actorId: id,
      model,
      thinking,
      tools,
      commTools,
      extensionPaths,
      comm:
        comm ??
        (this.#commUrl && id
          ? { url: this.#commUrl, actorId: id, namespace, authToken: this.#commAuthToken }
          : undefined),
      delivery,
      namespace,
      resident,
      initialTurn,
      crewMembers,
      crewLead,
      sandbox,
      armory,
    });
  }

  async list() {
    await this.#ensureLifecycle();
    return this.#lifecycle.list();
  }

  async inspect(id) {
    await this.#ensureLifecycle();
    const agent = await this.#lifecycle.inspect(id);
    if (!agent?.found || !agent.namespace || !this.#comm) return agent;
    const snapshot = await this.#comm.getStateSnapshot(agent.namespace).catch(() => undefined);
    const lifecycleStatus = snapshot?.nodes?.find((node) => node.handle === agent.name)?.status;
    if (!lifecycleStatus) return agent;
    return { ...agent, processStatus: agent.status, lifecycleStatus, status: lifecycleStatus };
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
    const ownerPid = this.#lifecycleProcess?.pid;
    await Promise.all([stopProcess(this.#lifecycleProcess), stopProcess(this.#commProcess)]);
    if (ownerPid) await removeOwner(this.cwd, ownerPid).catch(() => {});
    this.#lifecycle = undefined;
    this.#comm = undefined;
    this.#lifecycleProcess = undefined;
    this.#commProcess = undefined;
    this.#commUrl = undefined;
    this.#commAuthToken = undefined;
    this.#mainDeliveries = [];
    for (const unsubscribe of this.#stateUnsubscribers.values()) unsubscribe();
    this.#stateUnsubscribers.clear();
    for (const unsubscribe of this.#releaseUnsubscribers.values()) unsubscribe();
    this.#releaseUnsubscribers.clear();
    return {
      removals: removals.map((result) =>
        result.status === "fulfilled" ? result.value : { removed: false, error: String(result.reason) },
      ),
    };
  }
}
