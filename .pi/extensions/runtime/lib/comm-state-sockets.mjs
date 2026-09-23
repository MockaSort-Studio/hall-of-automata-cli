// Per-socket bookkeeping for CommController's "comm.observe_state" WS
// method: at most one state subscription per connected actor, mirroring
// comm-raw-observer-sockets.mjs's RawObserverSockets. Kept separate so
// comm-controller.mjs stays focused on routing/delivery; this is pure
// bookkeeping over an injected subscribe()/push() pair.
export class StateObserverSockets {
  #subscriptions = new Map();

  // Idempotent per actorId: a second "comm.observe_state" call for the same
  // socket is a no-op. `subscribe` is CommStateOwner#subscribe bound to a
  // namespace; `push(actorId, update)` delivers one compact status update
  // over that actor's own socket.
  subscribe(actorId, namespace, subscribeToState, push) {
    if (!this.#subscriptions.has(actorId)) {
      this.#subscriptions.set(
        actorId,
        subscribeToState(namespace, (update) => push(actorId, namespace, update)),
      );
    }
    return { observing: true };
  }

  release(actorId) {
    this.#subscriptions.get(actorId)?.();
    this.#subscriptions.delete(actorId);
  }
}
