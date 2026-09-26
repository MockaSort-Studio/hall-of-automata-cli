// Per-socket bookkeeping for CommController's "comm.observe_raw" WS method:
// at most one observeRaw() subscription per connected actor, so a repeat
// "comm.observe_raw" call or a reconnecting actor never accumulates
// duplicate pushes. Kept separate from comm-controller.mjs so that file
// stays focused on routing/delivery; this is pure bookkeeping over an
// injected observeRaw()/push() pair.
export class RawObserverSockets {
  #subscriptions = new Map();

  // Idempotent per actorId: a second call while already subscribed is a
  // no-op. `observeRaw` is CommController#observeRaw bound to the
  // controller; `push(actorId, envelope)` delivers one envelope over that
  // actor's own socket.
  subscribe(actorId, observeRaw, push) {
    if (!this.#subscriptions.has(actorId)) {
      this.#subscriptions.set(
        actorId,
        observeRaw((envelope) => push(actorId, envelope)),
      );
    }
    return { observing: true };
  }

  release(actorId) {
    this.#subscriptions.get(actorId)?.();
    this.#subscriptions.delete(actorId);
  }
}
