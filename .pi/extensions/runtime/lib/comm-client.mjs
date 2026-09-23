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
  const stateListeners = new Set();
  let observing;
  let observingState;
  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.method === "comm.deliver") listeners.forEach((listener) => listener(message.params));
    if (message.method === "comm.raw_envelope") rawListeners.forEach((listener) => listener(message.params));
    if (message.method === "comm.state_update") stateListeners.forEach((listener) => listener(message.params.nodes));
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
    // Typed, read-only Crew-run state: registerPlan seeds a run's static
    // shape once (Main, right after launchCrew starts Comm); getStateSnapshot
    // and observeState let any remote caller (the TUI monitor) read the
    // server-owned dependency-ledger status without ever touching a raw
    // envelope itself. One connection observes at most one namespace.
    registerPlan: (namespace, members) => request("comm.register_plan", { namespace, members }),
    getStateSnapshot: (namespace) => request("comm.state_snapshot", { namespace }),
    observeState: (namespace, listener) => {
      stateListeners.add(listener);
      observingState ??= request("comm.observe_state", { namespace });
      observingState.catch(() => {});
      return () => stateListeners.delete(listener);
    },
    // terminate(), not close(): a graceful close() waits for the server's
    // own close-frame response, which may never come (server already gone,
    // or busy). Callers (Runtime.stop(), the TUI's monitor-live-ledger.mjs
    // teardown) need a deterministic, immediate local socket teardown, not
    // a handshake -- see comm-controller.mjs's stop() for the server-side
    // half of this same fix.
    close: () => socket.terminate(),
  };
}
