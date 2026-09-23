// Keeps one live dependency-ledger instance current for the active Crew
// run's plan. Connects directly to that run's own CommController over
// WebSocket (roster.comm.url) as a dedicated, non-"main" observer actor
// (comm.observe_raw -- see comm-controller-dispatch.mjs /
// comm-raw-observer-sockets.mjs), instead of depending on this process's
// own Runtime having ever called startComm() for that run.
//
// Why not Runtime.observeRawComm()? A real Crew is launched by the Crew MCP
// tool's own Runtime/process, not by whichever process is watching the Plan
// tab (e.g. a separate `cc` TUI session). Runtime.observeRawComm() is a
// permanent no-op (`if (!this.#comm) return () => {}`) unless *this*
// Runtime instance itself started that Crew's Comm controller, which in a
// real TUI session it never has -- so the Plan tab never received a single
// envelope. `selected_crew_<uuid>.json` (the plan document) does not carry
// the Comm URL; only roster.json does, so callers must pass it through
// explicitly (see monitor.ts).
import { connectComm } from "../../runtime/lib/comm-client.mjs";
import { attachRawEnvelopeObserver, seedDependencyLedgerFromSelectedCrew } from "./dependency-ledger-wiring.mjs";

export function createLiveLedgerTracker() {
  let key;
  let ledger;
  let unsubscribe;
  let client;
  // The commUrl this tracker is currently connected (or connecting) to, so
  // a stale in-flight connect() from a torn-down run can detect it lost the
  // race and close itself instead of attaching to the wrong ledger.
  let connectedUrl;

  function teardown() {
    unsubscribe?.();
    unsubscribe = undefined;
    client?.close();
    client = undefined;
    connectedUrl = undefined;
    ledger = undefined;
    key = undefined;
  }

  function connect(runId, commUrl) {
    connectedUrl = commUrl;
    connectComm({ url: commUrl, actorId: `observer-${runId}` })
      .then((connected) => {
        if (connectedUrl !== commUrl) {
          // This run was torn down (or replaced by another) while the
          // socket was still connecting -- discard it, never attach.
          connected.close();
          return;
        }
        client = connected;
        unsubscribe = attachRawEnvelopeObserver(ledger, connected, `crew-${runId}`);
      })
      .catch(() => {
        // Comm not reachable yet (e.g. the run hasn't finished launching).
        // Leave connectedUrl cleared so the next ledgerFor() call with a
        // commUrl retries instead of being treated as already-connected.
        if (connectedUrl === commUrl) connectedUrl = undefined;
      });
  }

  return {
    // `selected` is the parsed selected_crew_<uuid>.json plan document (or
    // null/undefined when the active roster has no plan recorded yet).
    // `commUrl` is that same run's roster.comm.url, read and threaded
    // through by the caller (roster.json, not selected_crew_<uuid>.json,
    // carries it) -- absent until the run has actually started.
    // Keyed by runId: a new Crew run always rebuilds, an unchanged run
    // always reuses the same ledger and connection.
    ledgerFor(selected, commUrl) {
      const nextKey = selected?.runId;
      if (!nextKey) {
        teardown();
        return undefined;
      }
      if (nextKey !== key) {
        teardown();
        ledger = seedDependencyLedgerFromSelectedCrew(selected);
        key = nextKey;
      }
      if (commUrl && connectedUrl !== commUrl) connect(key, commUrl);
      return ledger;
    },
    stop: teardown,
  };
}
