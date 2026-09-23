// The Comm server's own typed live-state owner: turns the raw envelope
// stream it already observes in-process into one canonical dependency-
// ledger per Crew run, computed exactly once, server-side. Remote callers
// (the TUI monitor, potentially others) never reconstruct this DAG
// themselves from raw envelopes -- they ask for a typed snapshot or
// subscribe to compact status updates. See comm-controller.mjs (wiring),
// comm-client.mjs (client-side typed API), monitor-live-ledger.mjs (the
// TUI's read-only projection).
//
// `comm` is anything exposing `observeRaw(handler)` -- CommController
// itself, or an equivalent test double. No socket/WS concept lives here.
import { createDependencyLedger } from "./dependency-ledger.mjs";
import { attachRawEnvelopeObserver } from "./dependency-ledger-wiring.mjs";

// A typed snapshot node: { handle, status, dependsOn, task }.
// A compact status update: { handle, status } (no dependsOn/task -- those
// never change after a run's plan is registered, only status does).

export function createCommStateOwner(comm) {
  const runs = new Map(); // namespace -> { ledger, members, listeners: Set<fn>, unsubscribe }

  function compact(ledger) {
    return ledger.nodes().map((handle) => ({ handle, status: ledger.status(handle) }));
  }

  function notify(namespace) {
    const run = runs.get(namespace);
    if (!run) return;
    const update = compact(run.ledger);
    for (const listener of run.listeners) listener(update);
  }

  // Idempotent per namespace: a run's plan is fixed at kickoff time. A
  // repeat call (e.g. a reconnecting launcher retrying registration) never
  // rebuilds -- and so never discards -- live ledger state already in
  // progress.
  function registerPlan(namespace, members = []) {
    if (!namespace || runs.has(namespace)) return { registered: false };
    const ledger = createDependencyLedger();
    for (const member of members) ledger.addNode(member.handle);
    for (const member of members)
      for (const dependency of member.dependsOn || []) ledger.addDependency(member.handle, dependency);
    const run = { ledger, members, listeners: new Set() };
    // Both subscriptions land in the same underlying subscriber set, in
    // this call order -- so for any one envelope, the ledger has already
    // applied its transition before notify() reads it back out.
    const unsubscribeLedger = attachRawEnvelopeObserver(ledger, comm, namespace);
    const unsubscribeNotify = comm.observeRaw(() => notify(namespace));
    run.unsubscribe = () => {
      unsubscribeLedger();
      unsubscribeNotify();
    };
    runs.set(namespace, run);
    return { registered: true };
  }

  function snapshot(namespace) {
    const run = runs.get(namespace);
    if (!run) return undefined;
    const taskByHandle = new Map(run.members.map((member) => [member.handle, member.task ?? ""]));
    return {
      namespace,
      nodes: run.ledger.nodes().map((handle) => ({
        handle,
        status: run.ledger.status(handle),
        dependsOn: run.ledger.dependenciesOf(handle),
        task: taskByHandle.get(handle) ?? "",
      })),
    };
  }

  function subscribe(namespace, listener) {
    const run = runs.get(namespace);
    if (!run) return () => {};
    run.listeners.add(listener);
    return () => run.listeners.delete(listener);
  }

  function release(namespace) {
    runs.get(namespace)?.unsubscribe?.();
    runs.delete(namespace);
  }

  return { registerPlan, snapshot, subscribe, release };
}
