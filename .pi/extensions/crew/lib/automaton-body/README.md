# automaton-body

Canonical modular Crew member assembler.

```js
createRobot().install(module, ctx).build()
// { instructions, tools, model, thinking }
```

## Modules

- `baseModule()` — live shared contract
- `soulModule({ name })` — local Hall roster soul
- `roleModule({ role, override })` — behavioral role and model defaults
- `crewDisciplineModule()` — shared collaboration and communication contract

The active Crew extension entrypoint is `.pi/extensions/crew/index.ts`.
