// Keeps one live dependency-ledger instance current for the active Crew
// run's plan, wired to Runtime.observeRawComm's raw envelope stream
// (kickoff starts a node, a taskStatus report completes/fails/blocks it --
// see dependency-ledger-wiring.mjs) instead of reseeding a fresh,
// structural-only ledger from selected_crew_<uuid>.json on every dashboard
// open. One tracker per process/Runtime; ledgerFor() lazily (re)builds only
// when the underlying plan changes, tearing down the previous run's Comm
// subscription first so it never leaks across Crew runs.
import { attachRawEnvelopeObserver, seedDependencyLedgerFromSelectedCrew } from "./dependency-ledger-wiring.mjs";

export function createLiveLedgerTracker(runtime) {
  let key;
  let ledger;
  let unsubscribe;

  function teardown() {
    unsubscribe?.();
    unsubscribe = undefined;
    ledger = undefined;
    key = undefined;
  }

  return {
    // `selected` is the parsed selected_crew_<uuid>.json plan document (or
    // null/undefined when the active roster has no plan recorded yet).
    // Keyed by runId: a new Crew run always rebuilds, an unchanged run
    // always reuses the same ledger and subscription.
    ledgerFor(selected) {
      const nextKey = selected?.runId;
      if (!nextKey) {
        teardown();
        return undefined;
      }
      if (nextKey !== key) {
        teardown();
        ledger = seedDependencyLedgerFromSelectedCrew(selected);
        unsubscribe = attachRawEnvelopeObserver(ledger, { observeRaw: (handler) => runtime.observeRawComm(handler) });
        key = nextKey;
      }
      return ledger;
    },
    stop: teardown,
  };
}
