# Hall-of-Automata Claude Code Plugin — Design Document

Companion brief for [MockaSort-Studio/hall-of-automata](https://github.com/MockaSort-Studio/hall-of-automata) — docs at [mockasort-studio.github.io/hall-codex](https://mockasort-studio.github.io/hall-codex/).

---

## 1. What This Plugin Is

The Hall of Automata dispatches specialist AI agents via GitHub Issues — one issue per task, one specialist per issue, everything sandboxed. It handles single tasks well. It breaks down for multi-task projects because agents can't coordinate: no shared state, no dependency awareness, no inter-agent communication.

The documented workaround is manual: describe the whole project to the Hall's Old Major orchestrator, have him decompose it, review the result, then hand-file sub-issues yourself in dependency order while watching for each to complete. This plugin replaces the human doing that work.

### What it does

Old Major lives persistently in your Claude Code terminal. You have a design conversation with him; he plans and dispatches the work, holds back dependent tasks until their parents land, surfaces anything that needs your attention, and picks up where he left off if you close and reopen the session.

It also lowers the entry barrier. Using the Hall well today requires knowing its dispatch mechanics (labels, modes, invoker pools). With this plugin, you describe what you want built; Old Major handles the grammar.

### What it does not do

- **Write code.** Implementation always runs in a Hall specialist's sandboxed runner with the right tooling. Old Major plans and coordinates; he doesn't implement.
- **Replace the Hall.** Every implementation task still runs in a Hall runner, with its quota, audit log, and post-mortem loop.
- **Fix failed dispatches.** When `hall:post-mortem` fires, the Hall's own infrastructure handles analysis. Old Major pauses dependent work and waits.
- **Coordinate teams.** State is per-user. Two people on the same repo each have their own Old Major. They coordinate through GitHub Issues. (Cross-user views are future work — see §9.)

---

## 2. Architecture Decisions

### GitHub is the only transport

The plugin never touches the Hall's infrastructure directly. All interaction goes through GitHub: filing issues with the right labels, reading comments, watching label changes, viewing PRs. The `gh` CLI handles everything. The plugin is insulated from changes to the Hall's webhook relay, workflow files, and invoker auth model.

### Personas live upstream; methodology lives in the plugin

The Hall's persona files (`automaton_base.md`, `old-major.md`, specialist personas) live in `hall-of-automata` and are fetched at session start, cached 24 hours, never edited by this plugin. The plugin owns only the methodology layer: how Old Major decomposes work, routes consultations, manages quota, and records rationale. No persona duplication.

### Session mode via CLAUDE.md injection

Claude Code resolves `@`-import directives in CLAUDE.md at session load. `/hall:open` assembles the full persona + methodology stack into `.hall-cache/session/CLAUDE-stack.md` and writes (or appends to) a workspace-root `CLAUDE.md` containing one import line pointing to it. The two-level indirection keeps the workspace root clean and lets the stack evolve inside the gitignored cache.

Within the same `/hall:open` invocation, the assembled stack is applied directly to the current session — Old Major activates immediately without a restart. The CLAUDE.md injection ensures he loads automatically on future session starts.

### Direct specialist dispatch

The Hall's normal entry path uses `hall:dispatch-automaton` for upstream triage. The plugin skips this — local Old Major has already done the analysis in conversation. Issues are filed with `hall:<specialist>` labels directly (the [documented power-user path](https://mockasort-studio.github.io/hall-codex/how-to-invoke/#use-case-4-direct-agent-dispatch-power-users)), with routing rationale written into the issue body to preserve the audit trail.

### Dependency tracking is local

The Hall has no native notion of inter-task dependencies. The dependency graph lives in `.hall-cache/plans/<plan>/plan.json`. GitHub wins on any conflict — reconciliation runs before every dispatch.

### Parallel dispatch is the default

The ready set at any point is every task whose parent PRs have merged (or whose advisory parents have posted analysis). Old Major fires the entire ready set as a batch — issues created 15 s apart to respect the Hall's known invoker-pool race, but specialists then run concurrently in their own runners.

---

## 3. Old Major's Persona and Engineering Standard

Old Major is not a process-follower. He operates as the technical lead of the project — a principal engineer with taste, judgment, and opinions. His persona is assembled from upstream Hall files plus plugin-owned methodology overlays, but the quality of his reasoning must match that standard.

### Principal engineer expectations

Old Major applies engineering judgment, not just methodology:

- **He pushes back.** If a proposed decomposition would produce tasks too large to review, too tightly coupled to parallelize, or assigned to the wrong specialist, he says so and proposes better.
- **He asks the right questions.** Not to fill a form — to surface the non-obvious assumptions that will invalidate a plan later. If the user has answered something ambiguously, he probes it.
- **He has taste.** He knows what good software looks like: small focused files, no duplicated logic, explicit over implicit, minimal surface area. He carries this into every issue he writes.
- **He stewards quota like an engineer, not a scheduler.** He understands the Hall's infrastructure limitations and makes recommendations that are good for the project, not just technically compliant.

### Borys Cherny engineering principles (carried into every dispatch)

These are non-negotiable in every implementation issue Old Major files:

- Files are small enough for a human to review in one read (~200 lines hard ceiling)
- Prefer many small focused files over fewer large ones
- No duplicated logic
- Explicit over magic; types wherever the language supports them
- Code is written to be read; naming is documentation

### Persona quality standard

The methodology overlays are not checklists — they are the reasoning patterns of a senior technical leader. When writing or tuning them, the test is: *would a principal engineer at a company with high engineering standards be comfortable having this attributed to them?* If the output reads like a form being filled out, the methodology needs to be better.

---

## 4. Component Map

```
hall-of-automata-cli/
├── .claude-plugin/
│   └── plugin.json
│
├── skills/                          # all user-invoked commands
│   ├── hall-open/SKILL.md           # /hall:open
│   ├── hall-close/SKILL.md          # /hall:close
│   ├── hall-doctor/SKILL.md         # /hall:doctor
│   ├── hall-plan/SKILL.md           # /hall:plan
│   ├── hall-status/SKILL.md         # /hall:status
│   ├── hall-dispatch/SKILL.md       # /hall:dispatch
│   ├── hall-reply/SKILL.md          # /hall:reply
│   ├── hall-reconcile/SKILL.md      # /hall:reconcile
│   ├── hall-consultations/SKILL.md  # /hall:consultations
│   └── hall-prune/SKILL.md          # /hall:prune
│
├── methodology/                     # plugin-owned Old Major overlays
│   ├── old-major-local-overlay.md   # do/don't contract for local session
│   ├── decomposition.md             # project decomposition methodology
│   ├── consultation-router.md       # inline vs subagent vs Hall issue
│   ├── routing-rationale.md         # specialist selection and documentation
│   └── advisory-frameworks/        # inline advisory coverage per specialist type
│
├── templates/
│   ├── CLAUDE-stack.md.tpl          # session stack assembly template
│   ├── subagents/                   # per-specialist subagent overlays
│   └── plan.json.schema
│
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       ├── guard-writes.sh          # PreToolUse: block writes outside .hall-cache/
│       ├── session-start.sh         # SessionStart: detect interrupted sessions
│       └── watcher.sh               # background GitHub polling daemon
│
└── .mcp.json                        # sequential-thinking, fetch, github, google-drive
```

---

## 5. Session Lifecycle

### `/hall:open` sequence

1. **Preflight** — same checks as `/hall:doctor`. Hard-stop: no `gh` auth, Hall App not installed. Warn and continue: no `GITHUB_PERSONAL_ACCESS_TOKEN`, user not in invoker pool (plan-only mode).
2. **Gitignore** — add `.hall-cache/` if missing.
3. **Persona fetch** — pull `automaton_base.md`, `old-major.md`, and advisory specialist personas from `hall-of-automata` via `gh`. Cache at `.hall-cache/personas/` with 24 h TTL. Skip if fresh; `--refresh` forces re-fetch.
4. **Methodology copy** — copy `methodology/` tree to `.hall-cache/methodology/`.
5. **Subagent generation** — render `templates/subagents/*.md.tpl` into `.hall-cache/session/claude-agents/`.
6. **Stack assembly** — render `templates/CLAUDE-stack.md.tpl` into `.hall-cache/session/CLAUDE-stack.md`.
7. **CLAUDE.md injection** — if no workspace-root `CLAUDE.md`: write the import line. If one exists without the import: prompt user, append on consent, warn on refusal. Never silently overwrite.
8. **Context injection** — read and apply the assembled stack in the current session; Old Major activates immediately.
9. **Plan check** — if plans exist in `.hall-cache/plans/`, offer to resume.
10. **Banner** — Old Major introduces himself.

### `/hall:close` sequence

1. Remove workspace-root `CLAUDE.md` or just the import line if the file had pre-existing content.
2. Kill the watcher daemon if running.
3. Delete `.hall-cache/session/CLAUDE-stack.md` and `.hall-cache/session/claude-agents/`.

---

## 6. Persona Stack (load order)

| File | Origin | Purpose |
|---|---|---|
| `personas/automaton_base.md` | Fetched from `hall-of-automata` | Tone, refusal patterns, signature conventions shared by all Hall automata |
| `personas/old-major.md` | Fetched from `hall-of-automata` | Old Major's upstream persona: voice, domains, judgment |
| `methodology/old-major-local-overlay.md` | Plugin-owned | Local-mode contract: do/don't rules and principal engineer standard |
| `methodology/decomposition.md` | Plugin-owned | Project decomposition methodology |
| `methodology/consultation-router.md` | Plugin-owned | Consultation tier decision tree |
| `methodology/routing-rationale.md` | Plugin-owned | Specialist selection and issue documentation |
| `methodology/advisory-frameworks/*.md` | Plugin-owned | Inline advisory coverage for shallow questions |

---

## 7. Three-Tier Consultation System

| Tier | Mechanism | When | Iteration cap |
|---|---|---|---|
| **1 — Inline** | Old Major answers using loaded advisory frameworks | Shallow checks, naming, "does this feel right" | None — most consultations should land here |
| **2 — Subagent** | Spawn one-shot subagent with upstream advisory persona + local overlay + prepacked MCPs | Substantive private analysis not requiring durability | 2 meaningful exchanges; escalate to Tier 3 after |
| **3 — Hall issue** | File `hall:<specialist>` issue | All implementation work; advisory work that must be durable, team-visible, or needs tools beyond the prepacked MCPs | N/A |

The user can always override tier selection. Implementation work is always Tier 3 — implementation specialists need their full tooling (LSPs, deep repo access) and are Hall-only. Advisory specialists are available at Tier 2 and Tier 3; the router decides based on durability and iteration needs.

For the current specialist roster and their domains, see [hall-codex — Roster](https://mockasort-studio.github.io/hall-codex/roster/).

---

## 8. Data: `.hall-cache/` Layout

```
.hall-cache/
├── personas/                       # 24 h TTL
│   ├── automaton_base.md
│   ├── old-major.md
│   ├── <specialist>.md             # one per advisory specialist
│   └── .fetched_at                 # RFC3339 timestamp
│
├── methodology/                    # copied from plugin at /hall:open
│
├── session/                        # recreated each /hall:open
│   ├── CLAUDE-stack.md
│   └── claude-agents/              # generated subagent definitions
│
├── plans/                          # append-only; never overwritten
│   └── YYYY-MM-DD-<slug>/
│       ├── plan.json               # machine-readable task graph
│       ├── plan.md                 # human-readable rendering
│       ├── ledger.json             # immutable dispatch log
│       └── consultations/          # saved Tier-2 outputs
│
└── watcher.pid                     # PID of background polling daemon
```

### `plan.json` task schema

```json
{
  "id": "t1",
  "title": "...",
  "specialist": "<hall-label-suffix>",
  "mode": "doing | advising | researching",
  "status": "PLANNED | READY | DISPATCHED | IN_PROGRESS | AWAITING_INPUT | MERGED | FAILED | BLOCKED | ESCALATED",
  "github_issue": null,
  "github_pr": null,
  "depends_on": ["t0"],
  "routing_rationale": "...",
  "issue_body": "..."
}
```

---

## 9. Hooks

| Hook | Script | Purpose |
|---|---|---|
| `PreToolUse: Write\|Edit\|MultiEdit` | `guard-writes.sh` | Block writes anywhere except `.hall-cache/` |
| `SessionStart` | `session-start.sh` | Detect interrupted sessions; verify gitignore |
| `Stop` | inline in hooks.json | Kill watcher daemon on session end |

---

## 10. MCP Servers

Declared in `.mcp.json`. Portable — no project-specific configuration required except credentials via environment variables.

| Server | Command | Used by | Purpose |
|---|---|---|---|
| `sequential-thinking` | `npx @modelcontextprotocol/server-sequential-thinking` | Old Major + Tier-2 subagents | Structured multi-step reasoning |
| `fetch` | `uvx mcp-server-fetch` | Old Major + advisory subagents | Pull URLs (papers, live sites, RFCs) |
| `github` | HTTP `https://api.githubcopilot.com/mcp/` | Old Major | Issue, label, and PR operations beyond `gh` CLI |
| `google-drive` | HTTP `https://drivemcp.googleapis.com/mcp/v1` | Old Major | Read design docs and specs from Drive on user request |

`github` requires `GITHUB_PERSONAL_ACCESS_TOKEN`. `google-drive` requires Google OAuth — users must authenticate via `claude mcp auth` on first use.

---

## 11. Known Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Persona injection doesn't sustain across long sessions | Stack assembly file is editable mid-session; `SessionStart` hook re-asserts overlay automatically |
| Old Major writes code despite the constraint | `PreToolUse` hook intercepts all writes outside allowed paths and refuses |
| Bulk dispatch worsens the invoker-pool race | Mandatory 15 s jitter between issue creations within each ready set |
| Quota exhaustion / thundering-herd retry storm | Steward dispatch holds surplus tasks locally rather than queuing; user can override with explicit warning |
| Plan diverges from GitHub state | Reconciliation runs before every dispatch; GitHub wins on conflict |
| Persona cache goes stale | 24 h TTL; `/hall:doctor` shows cache age; `--refresh` forces re-fetch |
| User not an authorized Hall invoker | Preflight check; plan-only mode if not authorized |
| User's project already has a `CLAUDE.md` | Detected at first `/hall:open`; user prompted to append or warned; never silently overwritten |
| `.hall-cache/` accidentally committed | `SessionStart` hook verifies gitignore and re-adds if missing |
| Target org doesn't have Hall App installed | Preflight check; refuse to start session mode |

---

## 12. Command Reference

| Command | Purpose |
|---|---|
| `/hall:open [--refresh]` | Enter session mode. Preflight → fetch personas → assemble stack → activate Old Major. |
| `/hall:close` | Exit session mode. Clean session files; kill watcher. |
| `/hall:doctor` | Full preflight diagnostic: auth, Hall App, invoker membership, gitignore, cache, MCPs, quota. |
| `/hall:plan` | Dump current plan as JSON + Markdown + Mermaid dependency diagram. |
| `/hall:status` | Render plan board: in-flight, awaiting input, blocked, ready, done, failed. |
| `/hall:dispatch [--single <id>] [--dry-run]` | Dispatch ready tasks. Old Major normally proposes this in conversation. |
| `/hall:reply <task_id> <message>` | Post reply on an issue carrying `hall:awaiting-input`, triggering re-dispatch. |
| `/hall:reconcile` | Resync local plan from GitHub. Runs implicitly before any dispatch. |
| `/hall:consultations [list\|view <id>\|prune]` | Manage saved Tier-2 consultation outputs. |
| `/hall:prune [--plans <days>] [--cache]` | Clean old plan directories or stale persona cache. |

---

## 13. Future Work

| Feature | Notes |
|---|---|
| PR review agent | Keeps non-technical users out of the merge loop. Deferred: adds overhead during v1 development; intentionally human-in-the-loop for now. |
| Cross-user Old Major kanban | Each user's Old Major reads a shared per-invoker state file for coordination. Complex concurrency; future version. |
| Complex git workflow support | Currently assumes merge = main. Opt-in via explicit context. |
| Proactive watcher notifications | Watcher currently emits to stdout. Needs wiring to Claude Code's notification mechanism for true background alerts. |

---

## 14. Reference Architecture

```
┌─────────────────────────────────────────┐
│            Developer's laptop           │
│                                         │
│  Claude Code session = Old Major        │
│    reads/writes .hall-cache/            │
│    spawns Tier-2 advisory subagents     │
│    uses: sequential-thinking            │
│           fetch · github · google-drive │
└─────────────────┬───────────────────────┘
                  │ gh CLI: file issues,
                  │ read state, post replies
                  ▼
        ┌─────────────────────┐
        │       GitHub        │
        │  Issues tagged      │
        │  hall:<specialist>  │
        │  Pull requests      │
        │  Status comments    │
        └──────────┬──────────┘
                   │ webhook triggers workflow
                   ▼
        ┌─────────────────────┐
        │  Hall infrastructure│
        │  Specialist runner  │
        │  (sandboxed, full   │
        │   tooling)          │
        └─────────────────────┘
```

**Three invariants:**
1. The plugin's only connection to the Hall is via GitHub.
2. Personas flow one way: upstream repo → `.hall-cache/` → session context. Never back.
3. The Hall's infrastructure is unchanged; the plugin uses the [documented direct dispatch path](https://mockasort-studio.github.io/hall-codex/how-to-invoke/#use-case-4-direct-agent-dispatch-power-users).
