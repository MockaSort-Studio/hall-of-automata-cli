import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { CommEnvelopeObservation, projectEnvelope } from "./comm-envelope-observation.mjs";

export class CommController {
  #server;
  #connections = new Map();
  #inboxes = new Map();
  #inflight = new Map();
  #actors = new Set(["main"]);
  #pendingReplies = new Map();
  #observation = new CommEnvelopeObservation();
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
  broadcast(from, namespace, payload, includeMain = false) {
    const recipients = [...this.#actors].filter(
      (id) => (includeMain && id === "main") || (id.startsWith(`${namespace}-`) && id !== from),
    );
    return { accepted: true, recipients: recipients.map((to) => this.emit(from, to, payload).id) };
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
  #attach(socket) {
    let actorId;
    socket.on("message", (raw) => {
      const request = JSON.parse(String(raw));
      try {
        let result;
        if (request.method === "comm.register") {
          actorId = request.params.actorId;
          this.#connections.set(actorId, socket);
          this.#record("worker_registered", { actorId });
          result = { registered: actorId };
          setImmediate(() => this.#flush(actorId));
        } else if (request.method === "comm.register_actor") {
          this.registerActor(request.params.actorId);
          result = { registered: request.params.actorId };
        } else if (request.method === "comm.broadcast")
          result = this.broadcast(
            actorId,
            request.params.namespace,
            request.params.payload,
            request.params.includeMain,
          );
        else if (request.method === "comm.emit")
          result = this.emit(
            actorId,
            request.params.to,
            request.params.payload,
            request.params.replyRequired,
            request.params.replyTo,
          );
        else if (request.method === "comm.claim") result = this.claim(request.params.actorId);
        else if (request.method === "comm.ack") result = this.acknowledge(actorId, request.params.messageId);
        else if (request.method === "comm.inspect") result = this.events();
        this.#reply(socket, request.id, result);
      } catch (error) {
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { message: String(error) } }));
      }
    });
    socket.once("close", () => {
      if (actorId) {
        this.release(actorId);
        this.#connections.delete(actorId);
        this.#record("worker_disconnected", { actorId });
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
