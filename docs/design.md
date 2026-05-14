# Hall-of-Automata Claude Code Plugin — Design Document

Companion brief for [MockaSort-Studio/hall-of-automata](https://github.com/MockaSort-Studio/hall-of-automata) — docs at [mockasort-studio.github.io/hall-codex](https://mockasort-studio.github.io/hall-codex/).

---

## 1. What This Plugin Is

### The Problem

The Hall of Automata dispatches specialist AI agents via GitHub Issues — one issue per task, one specialist per issue, everything sandboxed and isolated. It works well for single, well-scoped tasks. It breaks down for multi-task projects because agents can't talk to each other, share state, or wait for each other's work to land.

The documented workaround is manual: open one issue describing the whole project, ask Old Major (the Hall's orchestrator persona) to decompose it, review the output, then hand-file sub-issues yourself in dependency order, watching for each to complete before filing the next.

This plugin replaces the human doing that coordination work.

### What It Does

The plugin gives Old Major a persistent local home — your Claude Code terminal — from which he:

- Has a design conversation with you until he understands the project well enough to plan it
- Decomposes the project into well-scoped tasks assigned to the right specialists
- Files all unblocked tasks in parallel (15 s apart to avoid the Hall's known invoker-pool race), holding back dependent tasks until their parents land
- Watches for state changes on GitHub (comments needing your input, PRs opening, merges happening, failures triggering post-mortem)
- Surfaces only what needs your attention; stays quiet otherwise
- Picks up exactly where he left off if you close and reopen Claude Code

### What It Does Not Do

| Non-goal | Rationale |
|---|---|
| Write code | Implementation specialists have the right tools (LSPs, repo access). Local Old Major would do worse work and conflating roles muddles design. |
| Replace the Hall | The Hall is the substrate. Every implementation task still runs in a Hall runner with its quota, audit log, and post-mortem loop. |
| Fix failed dispatches | When `hall:post-mortem` fires, the Hall's own Old Major analyzes it. Local Old Major pauses dependent work and waits. |
| Coordinate teams | State is per-user. Two people on the same repo each have their own Old Major. They coordinate through GitHub Issues. (Shared kanban view is future work — see §9.) |
| Replace Claude Code's plan mode | Old Major is not a better planner; he's a domain-specific orchestrator that speaks the Hall's dispatch grammar. |

---

## 2. Architecture Decisions

### GitHub is the only transport

The plugin never touches the Hall's infrastructure directly. Every interaction goes through GitHub: filing issues (with the right `hall:<specialist>` labels), reading comments, watching label changes, viewing PRs. The `gh` CLI handles all of this. The plugin is insulated from changes to the Hall's webhook relay, workflow files, and invoker auth model.

### Personas live upstream; methodology lives in the plugin

The Hall's persona files (`automaton_base.md`, `old-major.md`, advisory specialist personas) live in the `hall-of-automata` repository and are never edited by this plugin. The plugin fetches them at session start, caches them for 24 hours, and assembles a session stack on top of them.

What the plugin *owns* is the methodology layer: how Old Major decomposes work, routes consultations, manages quota, chooses specialists, and records rationale. There is no persona duplication.

### Session mode via CLAUDE.md injection

Claude Code resolves `@`-import directives in CLAUDE.md at session load. The plugin uses this mechanism to assemble Old Major:

1. `/hall:open` writes `.hall-cache/session/CLAUDE-stack.md` — the assembled stack that imports upstream persona files and plugin methodology overlays in order.
2. `/hall:open` then writes (or appends to) a workspace-root `CLAUDE.md` containing one line: `@.hall-cache/session/CLAUDE-stack.md`.
3. Claude Code resolves the chain; the session carries the full persona + methodology.
4. Within the same `/hall:open` invocation, the command reads and applies the assembled stack directly, so Old Major activates immediately without a session restart.

The two-level indirection keeps the workspace root clean and lets the session stack evolve inside the gitignored cache without touching the workspace.

### Direct specialist dispatch (bypassing Hall triage)

The Hall's normal entry path is `hall:dispatch-automaton`, which asks the Hall's own Old Major to triage and route. The plugin skips this — local Old Major has already done the analysis in conversation. Issues are filed with `hall:<specialist>` labels directly (the [documented power-user path](https://mockasort-studio.github.io/hall-codex/how-to-invoke/#use-case-4-direct-agent-dispatch-power-users)).

The routing rationale that upstream Old Major would normally produce is instead written into the issue body by local Old Major, preserving the audit trail without the round-trip.

### Dependency tracking is entirely local

The Hall has no native notion of inter-task dependencies. The dependency graph lives in `.hall-cache/plans/<plan>/plan.json`, and Old Major is the sole enforcer. GitHub wins on conflict (plan reconciles against GitHub state before every dispatch).

### Parallel dispatch is the default

The *ready set* at any point is every task whose parent PRs have merged (or whose advisory/research parents have posted their analysis). When the user approves dispatch, Old Major fires the entire ready set as a batch — issues created 15 s apart to respect the invoker-pool race, but specialists run concurrently in their own runners from that point.

---

## 3. Component Map

```
hall-of-automata-cli/
├── .claude-plugin/
│   └── plugin.json                  # manifest
│
├── skills/                          # all user-invoked commands and any auto-triggers
│   ├── hall-open/SKILL.md           # /hall:open
│   ├── hall-close/SKILL.md          # /hall:close
│   ├── hall-doctor/SKILL.md         # /hall:doctor (preflight diagnostics)
│   ├── hall-plan/SKILL.md           # /hall:plan (force-dump plan)
│   ├── hall-status/SKILL.md         # /hall:status (render board)
│   ├── hall-dispatch/SKILL.md       # /hall:dispatch (explicit dispatch step)
│   ├── hall-reply/SKILL.md          # /hall:reply <task_id> <message>
│   ├── hall-reconcile/SKILL.md      # /hall:reconcile (resync from GitHub)
│   ├── hall-consultations/SKILL.md  # /hall:consultations (list/view/prune)
│   └── hall-prune/SKILL.md          # /hall:prune (clean old plans/cache)
│
├── methodology/                     # plugin-owned Old Major methodology overlays
│   ├── old-major-local-overlay.md   # the do/don't contract for local session mode
│   ├── decomposition.md             # how to break a project into well-sized tasks
│   ├── consultation-router.md       # inline vs subagent vs Hall issue decision tree
│   ├── routing-rationale.md         # how to choose and document specialist assignment
│   └── advisory-frameworks/
│       ├── tomashco.md              # backend/systems analytical lens (inline coverage)
│       ├── frontenzo.md             # frontend critique lens
│       └── aeeeiii.md               # research/synthesis lens
│
├── templates/
│   ├── CLAUDE-stack.md.tpl          # session stack assembly template
│   ├── subagents/
│   │   ├── tomashco.md.tpl          # subagent overlay for Tier-2 Tomashco
│   │   ├── frontenzo.md.tpl         # subagent overlay for Tier-2 Frontenzo
│   │   └── aeeeiii.md.tpl           # subagent overlay for Tier-2 aeeeiii
│   └── plan.json.schema             # JSON schema for plan files
│
├── hooks/
│   ├── hooks.json                   # hook configuration
│   └── scripts/
│       ├── guard-writes.sh          # PreToolUse: block writes outside allowed paths
│       ├── session-start.sh         # SessionStart: verify .hall-cache state
│       └── watcher.sh               # background GitHub polling daemon
│
└── .mcp.json                        # sequential-thinking, fetch, github MCPs
```

---

## 4. Session Lifecycle

### `/hall:open` sequence

1. **Preflight** — run the same checks as `/hall:doctor` and abort on hard failures (no `gh` auth, Hall App not installed on target org, user not in invoker pool).
2. **Persona fetch** — pull `automaton_base.md` and `old-major.md` from `hall-of-automata` via `gh`. Cache at `.hall-cache/personas/` with a 24 h TTL. Skip if cached and fresh.
3. **Methodology copy** — copy `methodology/` tree to `.hall-cache/methodology/`. These are the plugin's own files; they don't need a TTL.
4. **Subagent generation** — render `templates/subagents/*.md.tpl` into `.hall-cache/session/claude-agents/` using the cached advisory personas. These are one-shot files; regenerated each open.
5. **Stack assembly** — render `templates/CLAUDE-stack.md.tpl` into `.hall-cache/session/CLAUDE-stack.md`, importing personas and methodology in order.
6. **CLAUDE.md injection** — check workspace root for an existing `CLAUDE.md`:
   - If none: write `@.hall-cache/session/CLAUDE-stack.md`.
   - If present and already has the import line: no-op.
   - If present without the import line: prompt user; on consent, append line; on refusal, warn that the stack won't load on next session restart.
7. **Gitignore check** — verify `.hall-cache/` is in `.gitignore`; add it if not.
8. **Context injection** — read the assembled stack and apply it in the current conversation, activating Old Major immediately.
9. **Banner** — Old Major introduces himself and asks what you want to build.

### `/hall:close` sequence

1. Remove workspace-root `CLAUDE.md` (or remove just the import line if the file had pre-existing content).
2. Delete `.hall-cache/session/CLAUDE-stack.md` and `.hall-cache/session/claude-agents/`.
3. Kill the watcher daemon if running (`.hall-cache/watcher.pid`).
4. Return the session to normal Claude Code.

---

## 5. Persona Stack (load order)

| File | Origin | Purpose |
|---|---|---|
| `personas/automaton_base.md` | Fetched from `hall-of-automata/agents/automaton_base.md` | Tone conventions, refusal patterns, signature conventions shared by all Hall automata |
| `personas/old-major.md` | Fetched from `hall-of-automata/roster/old-major.md` | Old Major's full upstream persona: voice, domains, judgment |
| `methodology/old-major-local-overlay.md` | Plugin-owned | Local-mode contract — the Do/Don't rules for session-mode operation |
| `methodology/decomposition.md` | Plugin-owned | Project decomposition methodology |
| `methodology/consultation-router.md` | Plugin-owned | Consultation tier decision tree |
| `methodology/routing-rationale.md` | Plugin-owned | Specialist selection and documentation |
| `methodology/advisory-frameworks/*.md` | Plugin-owned | Inline advisory coverage (shallow questions Old Major handles himself) |

---

## 6. Three-Tier Consultation System

When Old Major needs specialist depth, he uses one of three tiers — decided by `consultation-router.md`, not by the user (unless the user overrides).

### Tier 1 — Inline
Old Major answers using the loaded advisory frameworks. For: shallow architectural sanity-checks, naming, directory structure preferences, "does this feel right" judgments. Cost: free. **Most consultations should land here** — over-eager escalation to subagents is a named failure mode.

### Tier 2 — Subagent
Old Major spawns a Claude Code subagent loaded with the upstream advisory persona + a small local-mode subagent overlay. Prepacked MCPs: `sequential-thinking`, `fetch`, `github`. The subagent produces its analysis and returns. For: substantive design analysis that's private to the current conversation and doesn't need to be referenced by future work. **Iteration cap: 2 meaningful exchanges with the same specialist on the same topic** — after that, Old Major proposes escalating to Tier 3.

### Tier 3 — Hall Issue
Old Major files a `hall:<specialist>` issue. For: all implementation work (always Tier 3); advisory or research work that must be durable and team-visible, or that needs tools the prepacked MCPs don't provide.

| Specialist | Available as Tier 2? | Available as Tier 3? | Notes |
|---|---|---|---|
| Tomashco (backend/systems) | ✓ | ✓ | |
| Frontenzo (frontend critique) | ✓ | ✓ | |
| aeeeiii (research) | ✓ | ✓ | |
| Hamlet (C++) | ✗ | ✓ | Implementation — Hall-only |
| Pyrate (Python) | ✗ | ✓ | Implementation — Hall-only |
| mergio (CI/CD) | ✗ | ✓ | Implementation — Hall-only |

---

## 7. Data: `.hall-cache/` Layout and Schemas

```
.hall-cache/
├── personas/                       # 24 h TTL
│   ├── automaton_base.md
│   ├── old-major.md
│   └── .fetched_at                 # RFC3339 timestamp
│
├── methodology/                    # copied from plugin at /hall:open
│   ├── old-major-local-overlay.md
│   ├── decomposition.md
│   ├── consultation-router.md
│   ├── routing-rationale.md
│   └── advisory-frameworks/
│
├── session/                        # recreated each /hall:open
│   ├── CLAUDE-stack.md
│   └── claude-agents/
│       ├── tomashco.md
│       ├── frontenzo.md
│       └── aeeeiii.md
│
├── plans/                          # append-only by date + slug
│   └── 2026-05-12-kafka-ingest/
│       ├── plan.json               # machine-readable task graph
│       ├── plan.md                 # human-readable rendering
│       ├── ledger.json             # dispatch history (immutable log)
│       └── consultations/          # saved Tier-2 outputs
│
└── watcher.pid                     # PID of background polling daemon (if running)
```

### `plan.json` schema (abbreviated)

```json
{
  "id": "2026-05-12-kafka-ingest",
  "created_at": "2026-05-12T10:00:00Z",
  "repo": "org/repo",
  "tasks": [
    {
      "id": "t1",
      "title": "Implement deduplication window logic",
      "specialist": "pyrate",
      "mode": "doing",
      "status": "MERGED",
      "github_issue": 142,
      "github_pr": 147,
      "depends_on": [],
      "routing_rationale": "Pure Python logic with no frontend surface; Pyrate owns this domain."
    }
  ]
}
```

**Task statuses:** `PLANNED` → `READY` (deferred) → `DISPATCHED` → `IN_PROGRESS` → `AWAITING_INPUT` → `MERGED` | `FAILED` | `BLOCKED`

---

## 8. Hooks

### `PreToolUse: Write|Edit|MultiEdit`
**Script:** `hooks/scripts/guard-writes.sh`
Blocks any write to the target repository **except** `.hall-cache/plans/<plan>/plan.md` (and only with explicit user confirmation). This enforces the "Old Major doesn't write code" constraint mechanically.

### `SessionStart`
**Script:** `hooks/scripts/session-start.sh`
On every session start, checks whether a `.hall-cache/session/CLAUDE-stack.md` exists (indicating an interrupted session). If it does, loads the stack into context and presents a resume prompt.

---

## 9. Known Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Persona injection doesn't sustain across long sessions | Stack assembly file is editable mid-session; a `SessionStart` hook re-asserts the overlay automatically. Two-level @-import makes adjustment cheap. |
| Old Major writes code despite the constraint | `PreToolUse` hook intercepts all writes outside the allowed paths and refuses. |
| Bulk dispatch worsens the invoker-pool race | Mandatory 15 s jitter between issue creations within each ready set. |
| Quota exhaustion / thundering-herd retry storm | Steward dispatch: surplus tasks wait locally rather than queuing. User can override but is warned of consequences. |
| Plan diverges from GitHub state | Reconciliation runs implicitly before every dispatch; GitHub wins on conflict. |
| Persona cache goes stale | 24 h TTL; `/hall:doctor` shows cache age; explicit refresh via `/hall:open --refresh`. |
| User not an authorized Hall invoker | Preflight check verifies invoker membership; allows plan-only mode (no dispatch) if not authorized. |
| User's project already has a `CLAUDE.md` | Detected at first `/hall:open`; user prompted to either append the import line or be warned about next-session behavior. Never silently overwritten. |
| Subagent context overhead dominates for short consultations | Consultation router requires "substantive analysis needed" threshold for Tier 2; most questions route to Tier 1. |
| `.hall-cache/` accidentally committed | `SessionStart` hook verifies gitignore presence and re-adds if missing. |
| Target org doesn't have Hall App installed | Preflight check; refuse to start session mode. |

---

## 10. Command Reference

| Command | Purpose |
|---|---|
| `/hall:open [--refresh]` | Enter session mode. Preflight → fetch personas → assemble stack → inject context → show banner. `--refresh` forces persona re-fetch. |
| `/hall:close` | Exit session mode. Remove session files; kill watcher; restore session to normal Claude Code. |
| `/hall:doctor` | Full preflight diagnostic: gh auth, Hall App, invoker membership, gitignore, cache freshness, MCPs, quota state. |
| `/hall:plan` | Force-dump the current plan as JSON + Markdown + Mermaid dependency diagram. |
| `/hall:status` | Render the plan board (task list with statuses, in-flight issues, blocked tasks). |
| `/hall:dispatch [--single <task_id>] [--dry-run]` | Explicit dispatch step. Old Major normally proposes this in conversation. `--dry-run` previews without filing. |
| `/hall:reply <task_id> <message>` | Post a reply on an issue carrying `hall:awaiting-input`, triggering re-dispatch. |
| `/hall:reconcile` | Resync local plan state from GitHub. Runs implicitly before any dispatch. |
| `/hall:consultations [list|view <id>|prune]` | Manage saved Tier-2 subagent consultations. |
| `/hall:prune [--plans <age>] [--cache]` | Clean older plans or stale persona cache. |

---

## 11. MCP Servers

Declared in `.mcp.json`. Portable — no project-specific configuration required.

| Server | Used by | Purpose |
|---|---|---|
| `sequential-thinking` | Old Major + all Tier-2 subagents | Structured multi-step reasoning |
| `fetch` | Old Major, Tomashco, Frontenzo, aeeeiii | Pull URLs (papers, live sites, RFCs) |
| `github` | Old Major | Operations on issues, labels, and PRs beyond `gh` CLI defaults |

---

## 12. Comment Thread Resolutions

These questions were raised in the original design document and resolved in comments. They are recorded here to prevent reopening.

**Q: What are the limits of the specialist roster? Does this affect the plugin?**
A: The roster is open-ended — new specialists can be created targeting any technology. If no exact specialist covers a task, Old Major picks the closest. This doesn't affect plugin architecture; the plugin dispatches to whatever `hall:<specialist>` labels exist in the target repo.

**Q: Where does the user interact — terminal or Claude.ai app?**
A: Claude Code CLI (`cc` / `claude` command). The terminal is the interface. This is a Claude Code plugin, not a web app feature.

**Q: How does Old Major know what questions to ask?**
A: The `decomposition.md` methodology tells him to look for ambiguities in the stated requirements and ask about them. He's not running a fixed PRD template; he's resolving underdetermination in what you've described.

**Q: Is Old Major's plan mode better than Claude Code's native plan mode?**
A: They're different things. Claude Code's plan mode is a general-purpose pre-implementation structure tool. Old Major's planning is specifically about decomposing work for the Hall's specialist roster, managing dependencies across Hall-dispatched agents, and quota stewardship. The intelligence comes from persona engineering + injected methodology, not from a different planning engine.

**Q: How is Old Major's multi-task decomposition intelligence achieved?**
A: Persona engineering. The Hall's vanilla agents run in isolation — no coordination. The Claude Code session provides persistent context. `decomposition.md` and `routing-rationale.md` inject the methodology Old Major uses to structure and assign work.

**Q: Who reviews and merges PRs? The plugin requires the user to do this in v1.**
A: Yes, intentionally. Keeping the human in the merge loop is a v1 safety constraint while the plugin is being validated in use. A PR review agent that can handle merge for non-technical users is planned for a future version (see §13).

**Q: Do dependencies track main-branch merges or branch merges?**
A: Main-branch merges. The plugin doesn't model complex branching workflows. A user can override this by telling Old Major the repo uses a `dev` branch; he'd adapt the merge detection logic.

**Q: Could two users' Old Major sessions share a kanban view?**
A: Not in v1. Each user has an independent local session. They coordinate through GitHub Issues, which are already shared. A cross-user kanban board (keyed by invoker name) is planned for a future version (see §13).

---

## 13. Future Work (out of scope for v1)

| Feature | Trigger | Notes |
|---|---|---|
| PR review agent | Users who can't judge implementation quality | Optional; keeps human out of merge loop when enabled. Adds overhead during v1 development; deferred intentionally. |
| Cross-user Old Major kanban | Teams with multiple invokers on the same repo | Each user's Old Major reads a shared per-invoker state file; surfaces coordination needs. Complex concurrency to manage. |
| Complex git workflow support | Repos using `develop`/`staging` branch patterns | Currently assumes merge = main. Opt-in with explicit context setting. |
| Watcher daemon (proactive notifications) | Long-running projects where the user closes Claude Code between events | Background polling writes to a notification queue; picked up on next session start. |

---

## 14. Reference Architecture

```
┌─────────────────────────────────────────┐
│            Developer's laptop           │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  Claude Code session             │   │
│  │  (in /hall:open mode)            │   │
│  │  = Old Major                     │   │
│  └──────┬───────────────────────────┘   │
│         │ reads/writes                  │
│  ┌──────▼───────────────────────────┐   │
│  │  .hall-cache/                    │   │
│  │  personas · methodology ·        │   │
│  │  plans · session                 │   │
│  └──────────────────────────────────┘   │
│         │ spawns when needed            │
│  ┌──────▼───────────────────────────┐   │
│  │  Tier-2 subagents                │   │
│  │  Tomashco · Frontenzo · aeeeiii  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Prepacked MCPs: sequential-thinking    │
│                  fetch · github         │
└─────────┬───────────────────────────────┘
          │ gh CLI: file issues,
          │ read state, post replies
          ▼
┌─────────────────────┐
│       GitHub        │
│                     │
│  Issues tagged      │
│  hall:<specialist>  │
│                     │
│  Pull requests      │
│  Status comments    │
└──────────┬──────────┘
           │ webhook triggers workflow
           ▼
┌─────────────────────┐
│  Hall infrastructure│
│                     │
│  Workflow dispatch  │
│  Specialist runner  │
│  (sandboxed, full   │
│   tooling)          │
└─────────────────────┘
```

**Three invariants:**
1. The plugin's only connection to the Hall is via GitHub.
2. Personas flow one way: upstream repo → `.hall-cache/` → session context. Never back.
3. The Hall's infrastructure is unchanged; the plugin uses an existing documented dispatch path.
