# automaton-body

Modular robot: createRobot().install(module, ctx).build() -> {instructions, tools, model, thinking}

## Modules
- baseModule() — universal contract
- personaModule({name}) — soul from roster
- roleModule({role, task, override}) — discipline + tools + defaults

## Usage
node cli.mjs --name snowball --role advisor --task "..."

## Tracking
- KR 7.2 (#357) — single-specialist Stage Dispatch
- Item #366 — proven with Snowball advisor