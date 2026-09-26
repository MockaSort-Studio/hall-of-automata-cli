// RPC method dispatch for one CommController WS connection, extracted so
// comm-controller.mjs's socket wiring stays focused on connection lifecycle
// (registration bookkeeping, cleanup on close) rather than the growing list
// of comm.* methods themselves. `state` is the one mutable per-socket slot
// (`actorId`, assigned by comm.register) that both this dispatcher and the
// caller's close handler need to see.
export function dispatchCommRequest(controller, socket, state, request) {
  const { method, params } = request;
  if (method === "comm.register") {
    if (state.actorId) throw new Error("Actor already registered");
    state.actorId = params.actorId;
    controller.registerConnection(state.actorId, socket, params.namespace, params.authToken);
    return { registered: state.actorId };
  }
  if (method === "comm.register_actor") {
    if (state.actorId !== "main") throw new Error("Only Main may register actors");
    controller.registerActor(params.actorId);
    return { registered: params.actorId };
  }
  if (method === "comm.broadcast") {
    if (!state.actorId) throw new Error("Registered actor identity required");
    if (state.actorId !== "main" && !params.namespace) throw new Error("Namespace required");
    return controller.broadcast(state.actorId, params.namespace, params.payload, params.includeMain);
  }
  if (method === "comm.emit") {
    if (!state.actorId) throw new Error("Registered actor identity required");
    return controller.emit(state.actorId, params.to, params.payload, params.replyRequired, params.replyTo);
  }
  if (method === "comm.claim") {
    if (state.actorId !== params.actorId) throw new Error("Cannot claim another actor's mailbox");
    return controller.claim(params.actorId);
  }
  if (method === "comm.ack") return controller.acknowledge(state.actorId, params.messageId);
  if (method === "comm.inspect") {
    if (state.actorId !== "main") throw new Error("Only Main may inspect Comm");
    return controller.events();
  }
  if (method === "comm.observe_raw") return controller.observeRawOverSocket(state.actorId);
  if (method === "comm.register_plan") {
    if (state.actorId !== "main") throw new Error("Only Main may register plans");
    return controller.registerPlan(params.namespace, params.members);
  }
  if (method === "comm.lifecycle_update")
    return controller.lifecycleUpdate(state.actorId, params.namespace, params.state);
  if (method === "comm.state_snapshot") return controller.stateSnapshot(state.actorId, params.namespace);
  if (method === "comm.observe_state") return controller.observeStateOverSocket(state.actorId, params.namespace);
  return undefined;
}
