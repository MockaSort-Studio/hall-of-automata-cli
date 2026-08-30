# pi-automata-crew

Lead-first Crew workflow for Pi Fabric.

## Entrypoint

Run `startCrew` from `fabric_exec`:

```ts
const { startCrew } = await import("./pi-automata-crew/entrypoint.mjs");
return await startCrew({ task: "..." });
```

Main creates one Pi lead. The lead recruits specialists with recursive `agents.create`, governs the dispatch, and returns the final GitHub URLs and status.

## Design

- `pi/automaton-body/` is the canonical soul, role, and discipline assembler.
- GitHub is the durable state model.
- Mesh carries lifecycle signals only.
- `agents.tell`/`agents.ask` carry GitHub URLs for point-to-point communication.
- `tools: []` avoids granting raw shell access; Pi's host `fabric_exec` remains available to recursive Pi actors.
