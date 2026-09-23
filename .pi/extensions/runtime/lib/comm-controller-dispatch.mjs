// RPC method dispatch for one CommController WS connection, extracted so
// comm-controller.mjs's socket wiring stays focused on connection lifecycle
// (registration bookkeeping, cleanup on close) rather than the growing list
// of comm.* methods themselves. `state` is the one mutable per-socket slot
// (`actorId`, assigned by comm.register) that both this dispatcher and the
// caller's close handler need to see.
export function dispatchCommRequest(controller, socket, state, request) {
  const { method, params } = request;
  if (method === "comm.register") {
    state.actorId = params.actorId;
    controller.registerConnection(state.actorId, socket);
    return { registered: state.actorId };
  }
  if (method === "comm.register_actor") {
    controller.registerActor(params.actorId);
    return { registered: params.actorId };
  }
  if (method === "comm.broadcast")
    return controller.broadcast(state.actorId, params.namespace, params.payload, params.includeMain);
  if (method === "comm.emit")
    return controller.emit(state.actorId, params.to, params.payload, params.replyRequired, params.replyTo);
  if (method === "comm.claim") return controller.claim(params.actorId);
  if (method === "comm.ack") return controller.acknowledge(state.actorId, params.messageId);
  if (method === "comm.inspect") return controller.events();
  if (method === "comm.observe_raw") return controller.observeRawOverSocket(state.actorId);
  if (method === "comm.register_plan") return controller.registerPlan(params.namespace, params.members);
  if (method === "comm.state_snapshot") return controller.stateSnapshot(params.namespace);
  if (method === "comm.observe_state") return controller.observeStateOverSocket(state.actorId, params.namespace);
  return undefined;
}
