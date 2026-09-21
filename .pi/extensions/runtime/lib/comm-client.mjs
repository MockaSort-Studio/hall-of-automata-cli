import WebSocket from "ws";
export async function connectComm({ url, actorId }) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  let sequence = 0;
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = String(++sequence);
      const onMessage = (raw) => {
        const message = JSON.parse(String(raw));
        if (message.id === id) {
          socket.off("message", onMessage);
          message.error ? reject(new Error(message.error.message)) : resolve(message.result);
        }
      };
      socket.on("message", onMessage);
      socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  const listeners = new Set();
  const rawListeners = new Set();
  let observing;
  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.method === "comm.deliver") listeners.forEach((listener) => listener(message.params));
    if (message.method === "comm.raw_envelope") rawListeners.forEach((listener) => listener(message.params));
  });
  await request("comm.register", { actorId });
  return {
    emit: (params) => request("comm.emit", params),
    broadcast: (params) => request("comm.broadcast", params),
    registerActor: (id) => request("comm.register_actor", { actorId: id }),
    claim: (actor) => request("comm.claim", { actorId: actor }),
    acknowledge: (id) => request("comm.ack", { messageId: id }),
    inspect: () => request("comm.inspect", {}),
    onDelivery: (listener) => listeners.add(listener),
    // Subscribes this connection to every raw envelope the server observes
    // (comm-controller.mjs's observeRaw()), not just messages addressed to
    // this actor. The server-side subscription is created once per socket
    // and reused; each local listener still gets its own unsubscribe.
    observeRaw: (listener) => {
      rawListeners.add(listener);
      observing ??= request("comm.observe_raw", {});
      observing.catch(() => {});
      return () => rawListeners.delete(listener);
    },
    close: () => socket.close(),
  };
}
