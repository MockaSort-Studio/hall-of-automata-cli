import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

export class CommController {
  #server;
  #connections = new Map();
  #inboxes = new Map();
  #actors = new Set(["main"]);

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

  #attach(socket) {
    let actorId;
    socket.on("message", (raw) => {
      const request = JSON.parse(String(raw));
      if (request.method === "comm.register") {
        actorId = request.params.actorId;
        this.#connections.set(actorId, socket);
        this.#reply(socket, request.id, { registered: actorId });
        setImmediate(() => this.#flush(actorId));
      }
      if (request.method === "comm.emit") {
        const message = { id: randomUUID(), from: actorId, to: request.params.to, payload: request.params.payload };
        this.#inbox(message.to).push(message);
        this.#reply(socket, request.id, { accepted: true, id: message.id });
        this.#flush(message.to);
      }
    });
    socket.once("close", () => {
      if (actorId) this.#connections.delete(actorId);
    });
  }

  registerActor(actorId) {
    this.#actors.add(actorId);
    this.#inbox(actorId);
  }

  claim(actorId) {
    return this.#inbox(actorId).shift();
  }

  emit(from, to, payload) {
    if (!this.#actors.has(to)) throw new Error(`Unknown recipient: ${to}`);
    const message = { id: randomUUID(), from, to, payload };
    this.#inbox(to).push(message);
    this.#flush(to);
    return { accepted: true, id: message.id };
  }

  #inbox(actorId) {
    if (!this.#inboxes.has(actorId)) this.#inboxes.set(actorId, []);
    return this.#inboxes.get(actorId);
  }

  #flush(actorId) {
    const socket = this.#connections.get(actorId);
    const inbox = this.#inbox(actorId);
    while (socket?.readyState === 1 && inbox.length) {
      socket.send(JSON.stringify({ jsonrpc: "2.0", method: "comm.deliver", params: inbox.shift() }));
    }
  }

  #reply(socket, id, result) {
    socket.send(JSON.stringify({ jsonrpc: "2.0", id, result }));
  }
}
