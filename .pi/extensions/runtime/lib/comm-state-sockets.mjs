// Per-socket bookkeeping for CommController's "comm.observe_state" WS
// method: at most one state subscription per connected actor, mirroring
// comm-raw-observer-sockets.mjs's RawObserverSockets. Kept separate so
// comm-controller.mjs stays focused on routing/delivery; this is pure
// bookkeeping over an injected subscribe()/push() pair.
export class StateObserverSockets {
  #subscriptions = new Map();

  // Idempotent per actor/namespace, allowing Main to observe concurrent runs.
  subscribe(actorId, namespace, subscribeToState, push) {
    const key = `${actorId}:${namespace}`;
    if (!this.#subscriptions.has(key)) {
      this.#subscriptions.set(
        key,
        subscribeToState(namespace, (update) => push(actorId, namespace, update)),
      );
    }
    return { observing: true };
  }

  release(actorId) {
    for (const [key, unsubscribe] of this.#subscriptions) {
      if (key.startsWith(`${actorId}:`)) {
        unsubscribe();
        this.#subscriptions.delete(key);
      }
    }
  }
}
