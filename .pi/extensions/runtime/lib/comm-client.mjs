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
  await request("comm.register", { actorId });
  const listeners = new Set();
  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.method === "comm.deliver") listeners.forEach((listener) => listener(message.params));
  });
  return {
    emit: (params) => request("comm.emit", params),
    registerActor: (id) => request("comm.register_actor", { actorId: id }),
    claim: (actor) => request("comm.claim", { actorId: actor }),
    acknowledge: (id) => request("comm.ack", { messageId: id }),
    inspect: () => request("comm.inspect", {}),
    onDelivery: (listener) => listeners.add(listener),
    close: () => socket.close(),
  };
}
