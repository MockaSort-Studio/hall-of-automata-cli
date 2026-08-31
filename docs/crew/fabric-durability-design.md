# Durable Crew Recruitment

Status: Option C implemented and regression-tested locally.
Scope: Fabric fork at `/tmp/pi-fabric-policy-design`.

## Intended architecture

```text
Main → start_crew → durable Lead
                         ↓ create request
                 resident supervisor
                         ↓
             clean durable specialists
                         ↓
                   Lead manages work
```

The Lead chooses and manages the Crew. The resident supervisor owns process
creation, persistence, recovery, and removal. Main does not mediate routine
recruitment.

`build_crew_member` is the Crew-side factory: it assembles a soul, role, and
bounded assignment. `agents.create(..., residency:"durable")` is the lifecycle
boundary. In a nested Lead runtime, Fabric automatically routes that request
through `ResidentRecruitmentClient` to the authoritative resident supervisor.

Each specialist receives its own actor ID, `sessionFile`, explicit instructions,
and warm durable context. It does not inherit Main's conversation history.

## Verified defects

### 1. Resident supervisor ceded actors to itself

`src/residency/host.ts` handled `createActor` like this:

```ts
const actor = await this.actors.create(command.request);
await this.actors.cede(actor.id);
// wait up to 10 seconds for this host to adopt it again
```

The handler already runs inside the authoritative durable host. Ceding the new
actor immediately made its manager reject ownership. Because
`ActorManager.create()` refuses creation while any active actor is not locally
manageable, the next recruitment request failed with:

```text
Fabric actor registry is owned by another host
```

The correct fix is not to weaken `ActorManager` ownership fencing or change
explicit `cede()` semantics. The resident host simply keeps the actor it creates.
Resident request processing is already sequential.

### 2. Recruitment client checked the wrong owner path

`src/residency/recruitment-client.ts` reconstructed `owner.json` from its
requests directory and passed an already nested residency path back through
`residentRoot()`. The resulting path contained a duplicate `residency` segment.
It therefore reported:

```text
Root resident host exited while creating durable actor
```

even when the host was alive.

The client now stores the canonical `<residentRoot>/owner.json` path in its
constructor and checks it directly.

## Implemented Option C

- Removed create→cede→self-adopt from resident `createActor` handling.
- Corrected `ResidentRecruitmentClient` owner-path resolution.
- Kept strict ownership fences and explicit cede/reclaim behavior unchanged.
- Added an integration regression that submits two durable recruitment requests
  concurrently from the nested-client path.
- Asserted both actors are durable and have distinct clean session files.

## Verification

From `/tmp/pi-fabric-policy-design`:

- TypeScript typecheck: passed.
- Full `tests/residency.test.ts`: 8/8 passed.
- New concurrent nested-recruitment regression: passed.
- Fabric `dist/` rebuilt successfully.

## Operational note

A running Pi session and any resident host processes retain their loaded
JavaScript. Reload Pi before live verification so the configured
`fabricExtensionPath` and resident launcher use the rebuilt `dist/`.

After reload, the acceptance probe is:

1. Start one durable Lead.
2. Have it construct and concurrently request two durable specialists.
3. Confirm both appear as separate actors with distinct session files.
4. Confirm Main performed no creation or polling.
5. Have Lead wake, direct, review, and remove the specialists.
