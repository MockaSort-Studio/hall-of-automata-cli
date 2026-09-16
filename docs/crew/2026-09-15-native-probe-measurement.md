# Native Crew probe measurement — 2026-09-15

## Resume point

The explicit activation identity repair is implemented, tested, and live after reload:

- `.pi/extensions/crew/lib/communication-tools.ts` now includes `runId` in both the activation object and its mesh activation text.
- `.pi/extensions/crew/prompts/crew-discipline.md` says every `crew_*` call uses activation `runId`; `topic` is only a mesh topic.
- `crew_ask` and `crew_tell` remain available for real cross-role collaboration. Specialists are only told not to use `agents.*` for routine completion announcements.
- Regression coverage was added in `tests/crew/communication-tools.test.mjs` and `tests/crew/roles.test.mjs`.
- Focused suite passed: `node --test tests/crew/communication-tools.test.mjs tests/crew/roles.test.mjs tests/crew/assembly.test.mjs` (11/11).

## Runs

| Run | Outcome | Activity window | Key result |
| --- | --- | ---: | --- |
| `d016f1dc-6c7c-48b6-ad37-8aca7f2eb193` | cancelled after REVISE | 79.756 s | Architect used `topic` as `runId`; `crew_post` resolved a nonexistent `crew.<uuid>-roster.json`. |
| `81f9328e-b1f9-4679-8159-a92b3d2a8b38` | closed / accepted | 67.086 s | All three specialists used the supplied UUID and posted direct evidence. Discussion #439 closed; all actors removed. |

## Metrics from durable observability JSONL

### Pre-fix failed/recovery probe

| Role | Responses | Input tokens | Output tokens | First → max context |
| --- | ---: | ---: | ---: | ---: |
| Lead | 10 | 12,453 | 1,786 | 5,322 → 7,503 |
| Architect | 9 | 23,919 | 1,290 | 4,429 → 16,691 |
| Advisor | 3 | 5,525 | 244 | 4,334 → 4,581 |
| Developer | 3 | 5,896 | 209 | 4,469 → 4,682 |

Tool counts: 2 failed `crew_post`, 2 successful `crew_post`, 1 failed `fabric_exec`, 6 `fabric_exec`, 1 `crew_ask`, and 1 `crew_review` (`REVISE`). The run was manually cancelled and archived at `.pi/fabric/crew-observability/d016f1dc-6c7c-48b6-ad37-8aca7f2eb193-cancelled.json`.

### Repaired accepted probe

| Role | Responses | Input tokens | Output tokens | First → max context |
| --- | ---: | ---: | ---: | ---: |
| Lead | 17 | 20,721 | 2,975 | 5,385 → 11,692 |
| Architect | 4 | 6,444 | 308 | 4,550 → 4,961 |
| Advisor | 4 | 6,952 | 250 | 4,443 → 4,794 |
| Developer | 4 | 6,511 | 267 | 4,591 → 4,963 |

Tool counts: 3 successful `crew_post`, 3 `crew_ask`, 1 `crew_review` (`ACCEPT`), 1 `crew_close`, 1 `crew_unregister`, and 1 `crew_finish_close`. The Lead also made 6 `fabric_exec` calls, fetched comments twice, and made one failed `crew_begin_close` call before using the unattended close path.

## Evidence-backed effect

Architect is the cleanest comparison:

- max context: **16,691 → 4,961** (down 11,730; **70.3%**)
- input tokens: **23,919 → 6,444** (down 17,475; **73.1%**)
- responses: **9 → 4**
- failed `crew_post`: **2 → 0**

This confirms the activation UUID, not reduced Architect authority, fixed the failure and eliminated its expensive recovery detour.

## Historical comparison: before direct native tools

Closest completed comparable baseline: `c7e018ac-c812-452d-9c7b-f122148dbb12` (Discussion #436), the prior three-specialist run before the direct-native-tool change.

| Metric | #436 before | #439 now | Change |
| --- | ---: | ---: | ---: |
| Activity window | 60.438 s | 67.086 s | +6.648 s (+11.0%) |
| Total input tokens | 55,115 | 40,628 | -14,487 (-26.3%) |
| Total output tokens | 5,421 | 3,800 | -1,621 (-29.9%) |
| Explicit `fabric_exec` | 21 success + 3 failed | 6 success | -18 calls (-75.0%); failures eliminated |
| Explicit direct/core calls | 18 | 18 | unchanged |
| Lead max context | 15,069 | 11,692 | -3,377 (-22.4%) |
| Architect max context | 10,396 | 4,961 | -5,435 (-52.3%) |
| Advisor max context | 5,848 | 4,794 | -1,054 (-18.0%) |
| Developer max context | 5,222 | 4,963 | -259 (-5.0%) |

The same direct/core-call count masks the meaningful shift: #436 routed 24 explicit Fabric calls (including 3 failures) through `fabric_exec`; #439 used 6 and performed native `crew_*` / GitHub calls directly. Timing is slightly slower because #439 emitted three redundant Lead asks; without them, latency should improve too.

## Known issue: Lead `crew_ask` recovery

The repaired run proved `crew_ask` is not an effective completion detector yet:

1. The Lead posted three status asks after the specialists had already posted (or while Architect's post was in flight).
2. Each ask reactivated the specialist, and the specialist emitted an out-of-band Fabric status message, but did not create a `crew_reply` comment.
3. The Lead only accepted after its later `github_discussion_comments` fetch observed the three original findings.

Therefore `crew_ask` currently causes redundant Discussion comments and reactivations; it did not provide evidence the Lead used for acceptance. Preserve `crew_ask`/`crew_tell` as needed collaboration tools, but investigate the Lead recovery loop and the wrapper-to-`agents.ask` response channel before relying on asks as an evidence mechanism.

Likely next work:

- Trace the native `crew_ask` wrapper and the Lead's missing-evidence loop.
- Make the Lead refresh Discussion comments before issuing asks, and avoid asks for already-posted evidence.
- Decide whether an ask requires a mandatory native `crew_reply`, or whether Fabric status should be explicitly returned to the Lead.
- Remove/guard the unattended-mode `crew_begin_close` attempt.

## Stable evidence

- Accepted record: https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/439
- Successful run events: `.pi/fabric/crew-observability/81f9328e-b1f9-4679-8159-a92b3d2a8b38.jsonl`
- Failed/cancelled run archive: `.pi/fabric/crew-observability/d016f1dc-6c7c-48b6-ad37-8aca7f2eb193-cancelled.json`
