import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { CommEnvelopeObservation, projectEnvelope } from "./comm-envelope-observation.mjs";
import { RawObserverSockets } from "./comm-raw-observer-sockets.mjs";
import { dispatchCommRequest } from "./comm-controller-dispatch.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class CommController {
  #server;
  #connections = new Map();
  #inboxes = new Map();
  #inflight = new Map();
  #actors = new Set(["main"]);
  #pendingReplies = new Map();
  #observation = new CommEnvelopeObservation();
  // Per-socket observeRaw() subscriptions for "comm.observe_raw" below, so
  // an out-of-process observer (e.g. Main's live dependency ledger) gets
  // the same unfiltered stream observeRaw() gives in-process callers.
  #rawSockets = new RawObserverSockets();
  // A synchronous broadcast delivers every resident worker's first prompt in
  // the same tick, which has produced a real, reproducible collision: near-
  // simultaneous fresh sessions racing the same provider/session-auth path,
  // where most of them come back with a degenerate zero-usage turn. This is
  // a scheduling fix (space activations out), not a retry: it never loops
  // and never masks a genuine failure, it just avoids manufacturing the
  // collision in the first place. 0 disables it (tests; also the existing,
  // pre-fix behavior).
  #broadcastStaggerMs;
  constructor({ broadcastStaggerMs = 250 } = {}) {
    this.#broadcastStaggerMs = broadcastStaggerMs;
  }
  async start(port = 0) {
    this.#server = new WebSocketServer({ port });
    await new Promise((resolve) => this.#server.once("listening", resolve));
    this.#server.on("connection", (socket) => this.#attach(socket));
    return this.#server.address().port;
  }
  async stop() {
    for (const socket of this.#connections.values()) socket.close();
    await new Promise((resolve) => this.#server.close(resolve));
  }
  registerActor(actorId) {
    this.#actors.add(actorId);
    this.#inbox(actorId);
    this.#record("actor_registered", { actorId });
  }
  emit(from, to, payload, replyRequired = false, replyTo) {
    if (replyTo && !this.#pendingReplies.has(replyTo)) throw new Error("Unknown reply request");
    if (!this.#actors.has(to)) throw new Error(`Unknown recipient: ${to}`);
    const queuedAt = Date.now();
    const message = {
      v: 1,
      id: randomUUID(),
      kind: replyTo ? "reply" : replyRequired ? "request" : "notify",
      from,
      to,
      payload,
      replyRequired,
      replyTo,
      createdAt: new Date(queuedAt).toISOString(),
      queuedAt,
    };
    this.#inbox(to).push(message);
    if (replyRequired) this.#pendingReplies.set(message.id, message);
    if (replyTo) {
      const request = this.#pendingReplies.get(replyTo);
      this.#pendingReplies.delete(replyTo);
      this.#record("message_replied", {
        ...this.#metrics(message),
        replyTo,
        replyLatencyMs: Date.now() - request.queuedAt,
      });
    }
    this.#record("message_emitted", this.#metrics(message));
    this.#publish(message);
    this.#flush(to);
    return { accepted: true, id: message.id };
  }
  // Delivers with a fixed gap between recipients instead of all at once, so
  // resident workers' first real provider request never lands in the same
  // instant. Order is insertion order of #actors (registration order), which
  // is stable and deterministic, not randomized.
  async broadcast(from, namespace, payload, includeMain = false) {
    const recipients = [...this.#actors].filter(
      (id) => (includeMain && id === "main") || (id.startsWith(`${namespace}-`) && id !== from),
    );
    const ids = [];
    for (const [index, to] of recipients.entries()) {
      if (index > 0 && this.#broadcastStaggerMs > 0) await sleep(this.#broadcastStaggerMs);
      ids.push(this.emit(from, to, payload).id);
    }
    return { accepted: true, recipients: ids };
  }
  claim(actorId) {
    if (this.#inflight.has(actorId)) return undefined;
    const message = this.#inbox(actorId).shift();
    if (message) {
      this.#inflight.set(actorId, message);
      this.#record("message_claimed", this.#metrics(message));
    }
    return message;
  }
  acknowledge(actorId, messageId) {
    const message = this.#inflight.get(actorId);
    if (!message || message.id !== messageId) return { acknowledged: false };
    this.#inflight.delete(actorId);
    this.#record("message_acknowledged", this.#metrics(message));
    this.#flush(actorId);
    return { acknowledged: true };
  }
  release(actorId) {
    const message = this.#inflight.get(actorId);
    if (!message) return;
    this.#inflight.delete(actorId);
    this.#inbox(actorId).unshift(message);
    this.#record("message_requeued", this.#metrics(message));
  }
  events() {
    return this.#observation.events();
  }
  // Adapter-facing: emits only the narrow human-readable projection.
  subscribe(handler) {
    return this.#observation.observe((envelope) => {
      const projected = projectEnvelope(envelope);
      if (projected) return handler(projected);
    });
  }
  // Internal-facing: emits the full raw envelope for runtime observers
  // (e.g. a dependency ledger) that need payload kind and kickoff data.
  observeRaw(handler) {
    return this.#observation.observe(handler);
  }
  injectHuman({ to, body, author, externalId }) {
    return this.emit("human:github-discussion", to, { message: body, author, externalId }, true);
  }
  // Registration bookkeeping shared by comm.register's dispatch handler:
  // track the socket under its actorId, record the event, and flush any
  // message already queued for it before the socket connected.
  registerConnection(actorId, socket) {
    this.#connections.set(actorId, socket);
    this.#record("worker_registered", { actorId });
    setImmediate(() => this.#flush(actorId));
  }
  observeRawOverSocket(actorId) {
    if (!actorId) throw new Error("comm.observe_raw requires a registered actorId");
    return this.#rawSockets.subscribe(actorId, this.observeRaw.bind(this), (id, envelope) => {
      const socket = this.#connections.get(id);
      if (socket?.readyState === 1)
        socket.send(JSON.stringify({ jsonrpc: "2.0", method: "comm.raw_envelope", params: envelope }));
    });
  }
  #attach(socket) {
    const state = { actorId: undefined };
    socket.on("message", async (raw) => {
      const request = JSON.parse(String(raw));
      try {
        const result = await dispatchCommRequest(this, socket, state, request);
        this.#reply(socket, request.id, result);
      } catch (error) {
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { message: String(error) } }));
      }
    });
    socket.once("close", () => {
      if (state.actorId) {
        this.release(state.actorId);
        this.#connections.delete(state.actorId);
        this.#rawSockets.release(state.actorId);
        this.#record("worker_disconnected", { actorId: state.actorId });
      }
    });
  }
  #inbox(actorId) {
    if (!this.#inboxes.has(actorId)) this.#inboxes.set(actorId, []);
    return this.#inboxes.get(actorId);
  }
  #flush(actorId) {
    const socket = this.#connections.get(actorId);
    if (!socket || socket.readyState !== 1 || this.#inflight.has(actorId)) return;
    const message = this.claim(actorId);
    if (!message) return;
    this.#record("message_delivered", this.#metrics(message));
    socket.send(JSON.stringify({ jsonrpc: "2.0", method: "comm.deliver", params: message }));
  }
  #metrics(message) {
    return {
      messageId: message.id,
      from: message.from,
      to: message.to,
      payloadBytes: Buffer.byteLength(JSON.stringify(message.payload)),
      latencyMs: Date.now() - message.queuedAt,
    };
  }
  #publish(envelope) {
    this.#observation.publish(envelope);
  }
  #record(type, details) {
    this.#observation.record(type, details);
  }
  #reply(socket, id, result) {
    socket.send(JSON.stringify({ jsonrpc: "2.0", id, result }));
  }
}
