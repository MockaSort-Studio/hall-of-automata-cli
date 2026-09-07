# automaton-body

Canonical modular Crew member assembler.

```js
createRobot().install(module, ctx).build()
// { instructions, tools, model, thinking }
```

## Modules

- `safetyModule()` — local prompt-injection and hard-stop contract
- `soulModule({ name })` — checked-in local Hall roster soul
- `agents/agents.json` and `roster/*.md` — authoritative local Crew catalog and specialist souls
- `roleModule({ role, override })` — behavioral role and model defaults
- `crewDisciplineModule()` — shared collaboration and communication contract

The active Crew extension entrypoint is `.pi/extensions/crew/index.ts`.
