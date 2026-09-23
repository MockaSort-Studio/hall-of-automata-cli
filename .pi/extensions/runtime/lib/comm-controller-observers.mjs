// Wires CommController's two out-of-process observer surfaces: the raw
// envelope stream ("comm.observe_raw") and the typed live-state API
// ("comm.register_plan"/"comm.state_snapshot"/"comm.observe_state").
// Extracted so comm-controller.mjs stays focused on mailbox/delivery
// instead of growing with push-message framing for each observer kind.
import { RawObserverSockets } from "./comm-raw-observer-sockets.mjs";
import { StateObserverSockets } from "./comm-state-sockets.mjs";
import { createCommStateOwner } from "../../crew/lib/comm-state-owner.mjs";

// `observeRaw` is CommController#observeRaw bound to the controller;
// `getSocket(actorId)` looks up that actor's live connection, if any.
export function createCommObservers({ observeRaw, getSocket }) {
  const rawSockets = new RawObserverSockets();
  // Lifecycle updates, not free-form Comm envelopes, own typed run state.
  const stateOwner = createCommStateOwner();
  const stateSockets = new StateObserverSockets();
  const send = (actorId, message) => {
    const socket = getSocket(actorId);
    if (socket?.readyState === 1) socket.send(JSON.stringify(message));
  };
  return {
    observeRawOverSocket(actorId) {
      if (!actorId) throw new Error("comm.observe_raw requires a registered actorId");
      return rawSockets.subscribe(actorId, observeRaw, (id, envelope) =>
        send(id, { jsonrpc: "2.0", method: "comm.raw_envelope", params: envelope }),
      );
    },
    registerPlan: (namespace, members) => stateOwner.registerPlan(namespace, members),
    lifecycleUpdate: (actorId, namespace, state) => stateOwner.update(namespace, actorId, state),
    stateSnapshot: (namespace) => stateOwner.snapshot(namespace),
    observeStateOverSocket(actorId, namespace) {
      if (!actorId) throw new Error("comm.observe_state requires a registered actorId");
      return stateSockets.subscribe(actorId, namespace, stateOwner.subscribe, (id, ns, update) =>
        send(id, { jsonrpc: "2.0", method: "comm.state_update", params: { namespace: ns, nodes: update } }),
      );
    },
    release(actorId) {
      rawSockets.release(actorId);
      stateSockets.release(actorId);
    },
  };
}
