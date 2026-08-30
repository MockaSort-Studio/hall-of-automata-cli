# automaton-body

Canonical modular Crew member assembler.

```js
createRobot().install(module, ctx).build()
// { instructions, tools, model, thinking }
```

## Modules

- `baseModule()` — live shared contract
- `soulModule({ name })` — live Hall roster soul
- `roleModule({ role, override })` — role discipline and model defaults
- `crewDisciplineModule()` — GitHub-only state and communication rules

The Crew workflow entrypoint is `pi-automata-crew/entrypoint.mjs`.
