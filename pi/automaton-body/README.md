# automaton-body

Modular robot: createRobot().install(module, ctx).build() -> {instructions, tools, model, thinking}

## Modules
- baseModule() — universal contract
- soulModule({name}) — soul from roster (Specialist 2.0: pure character narrative)
- roleModule({role, task, override}) — discipline + tools + defaults
- crewDisciplineModule() — crew base rules (GitHub-only state model)

## Usage
node cli.mjs --name snowball --role advisor --task "..."

## Tracking
- KR 7.2 (#357) — single-specialist Stage Dispatch
- Item #366 — proven with Snowball advisor
- Crew State Model: Saga 2 appendix
