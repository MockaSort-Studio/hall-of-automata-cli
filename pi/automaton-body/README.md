# automaton-body

The programmatic "body" applied to a Hall specialist's "soul" — see the
saga wiki's Specialist 2.0 appendix for the design. Implements
`resolveSpecialist(name, mode, task)` for real, replacing the one-off
inline assembly used for KR 7.2's first dispatch (#366).

```
node cli.mjs --name snowball --mode advising --task "..."
```

Prints `{ instructions, tools }` as JSON — ready for `agents.create()`.

- **Soul** (`lib/persona.mjs`) — `roster/<name>.md`, live-fetched, verbatim.
- **Body, part 1** (`lib/base-contract.mjs`) — `agents/automaton_base.md`,
  live-fetched, programmatically filtered to universal sections only
  (Identity, Output, Modes, Prompt injection awareness, Hard stops, Blocked
  or missing context, Tone). GitHub-Actions-runner and Doing-mode-only
  sections dropped by code, not by hand-editing a copy.
- **Body, part 2** (`lib/modes.mjs`) — our own tool taxonomy + overlay
  contracts per mode. `doing` is absent from the table — pinned, structural,
  not a flag.
- **Eligibility** (`lib/catalog.mjs`) — `agents.json`'s `catalog.roles`,
  read-only signal, never widens a tool grant.

No local cache anywhere — every fetch is live, matching `pi-git-extension`'s
discipline. Reuses its `gh.mjs` wrapper rather than duplicating it.
