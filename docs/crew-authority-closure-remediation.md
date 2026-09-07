# Crew Authority and Closure Remediation

Issue [#416](https://github.com/MockaSort-Studio/hall-of-automata-cli/issues/416) is implemented by the Crew tool boundary. The canonical decision record is [Discussion #417](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/417).

## Enforced invariants

- Only the rostered Lead may create the canonical Discussion, mutate roster or inbox state, invoke lifecycle transitions, or broadcast.
- Specialists retain directed asks, tells, findings, and root-thread replies.
- `crew_unregister` accepts only verified `{ actorId, removed: true }` results.
- `crew_reconcile_absent` removes only rostered actors and appends an audited absence record with its observation time.
- `crew_begin_close` queries GitHub. Human-gated closure rejects an open Discussion.
- The monitor remains visible while the roster is `closing`; it clears only after terminal closure.

## Verification

Focused Crew tests cover authorization denial, verified live removal, audited absence reconciliation, GitHub closure gating, root-thread replies, and terminal monitor removal.
