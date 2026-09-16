# Pi Crew Runtime Structure

Status: canonical for the stabilized `dev` branch.

## Supported entrypoints

Pi discovers three project-local extensions:

- `.pi/extensions/crew/index.ts` — durable Crew orchestration.
- `.pi/extensions/github/index.ts` — bounded GitHub tools used by Crew.
- `.pi/extensions/web/index.ts` — bounded web fetch for research.

`tests/pi/test-extension-load.sh` is the relocation smoke test. Any new runtime path must keep that test passing.

## Launch path

1. Main calls `start_crew`.
2. `start_crew` writes queued state under `.pi/fabric/crew-launch/`:
   - `<runId>.json` — launch config and launch program.
   - `<runId>-roster.json` — durable roster and lifecycle state.
3. `start_crew` queues a Pi follow-up that executes the launch program in the normal `fabric_exec` path.
4. The launch program creates one durable Lead actor with `agents.create`.
5. The Lead creates the canonical GitHub Discussion, recruits specialists, and owns review and closure.

There is no extension-side supervisor, no `/crew-start` command, no generated user-facing launch code beyond the queued follow-up, and no direct `pi.agents` or `pi.tools.call` API.

## Actor model

- Lead role: `lead-old-major`.
- Supported specialist roles: `architect`, `advisor`.
- Unsupported for this cycle: `developer` / Doing mode.

Specialists are assembled by `build_crew_member`, which calls `assembly.mjs` and combines:

- checked-in persona soul from `.pi/extensions/crew/roster/*.md`,
- role discipline from `.pi/extensions/crew/lib/automaton-body/lib/roles/`,
- shared safety and Crew communication discipline,
- a bounded assignment.

Roles are read/search/GitHub-comment oriented. Raw shell and repository writes are intentionally absent from Crew roles.

## State and communication

- Roster JSON is the lifecycle authority for Crew membership and closure.
- GitHub Discussion is the durable, human-readable content record.
- Fabric topics are lifecycle/control signals only; substantive findings are posted to GitHub first.
- Sender names are roster handles and, when running inside a Fabric actor, are bound to `PI_FABRIC_ACTOR_ID`.

## Closure path

Unattended runs call `crew_close`, return `FINAL`, unregister specialists after verified removal, call `crew_finish_close`, then remove the Lead last.

Human-gated runs poll human requests only while started. Once GitHub closure is observed, the Lead calls `crew_begin_close`, reconciles/removes specialists, calls `crew_finish_close`, then removes itself.

## Removed paths

The following are not supported runtime paths and should not reappear:

- resident lifecycle supervisor code in this repo,
- host-specific Fabric fork paths,
- raw `bash` as a normal specialist capability,
- `developer` / code-writing Crew dispatch,
- local mirrors of GitHub content,
- mesh events carrying substantive content.
