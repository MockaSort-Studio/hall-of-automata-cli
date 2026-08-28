# automaton-body

The programmatic "body" applied to a Hall specialist's "soul" — see the
saga wiki's Specialist 2.0 appendix for the design. Implements role-based
dispatch: Identity (soul + domain) vs Capacity (role chosen per task).

```
node cli.mjs --name snowball --role advisor --task "..."
```

Prints `{ instructions, tools, model?, thinking? }` as JSON — ready for `agents.create()`.

## Two Orthogonal Axes

**Identity** — fixed per specialist, extracted from persona:
- Soul: `roster/<name>.md`, live-fetched, verbatim
- Domain: `agents.json` `catalog.domains`

**Capacity** — chosen per dispatch:
- Role: `advisor | architect | researcher | developer | lead`
- Each role: discipline + methodology + tools + default model/thinking
- Model/effort can be dynamically overridden: `--model <name> --thinking <low|medium|high>`

## Roles

| Role | Status |
|------|--------|
| `advisor` | ✅ Proven (Snowball #366) |
| `researcher` | Defined, not yet dispatched |
| `architect` | Named, methodology stub |
| `developer` | Pinned, absent |
| `lead` | Named for KR 7.3, not yet wired |

## Files

- `lib/persona.mjs` — soul, `roster/<name>.md`
- `lib/base-contract.mjs` — universal automaton contract, programmatically filtered
- `lib/catalog.mjs` — `agents.json` roles/domains, eligibility signal
- `lib/roles.mjs` — role definitions (discipline, methodology, tools, defaults)
- `lib/resolve.mjs` — `installRole(name, role, task, override?)` orchestration
- `cli.mjs` — thin wrapper, prints JSON

No local cache — every fetch is live.
