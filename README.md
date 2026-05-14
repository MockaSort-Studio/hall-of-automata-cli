# Hall of Automata — Claude Code Plugin

Local orchestrator for multi-task projects on the [Hall of Automata](https://github.com/MockaSort-Studio/hall-of-automata). Plan decomposition, agent dispatch, and task coordination — all via a design conversation with Old Major.

## Prerequisites

- [Claude Code](https://claude.ai/code) CLI (`cc`)
- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated to `MockaSort-Studio`
- `GITHUB_PERSONAL_ACCESS_TOKEN` set in your environment or `~/.claude/settings.json`

## Installation

### Local (development)

```bash
git clone https://github.com/MockaSort-Studio/hall-of-automata-cli
cc --plugin-dir /path/to/hall-of-automata-cli
```

Or set it permanently in `~/.claude/settings.json`:

```json
{
  "plugins": [
    { "path": "/path/to/hall-of-automata-cli" }
  ]
}
```

### Marketplace (when published)

```
/plugin install hall-of-automata@claude-plugins-official
```

## Quick Start

Open a Claude Code session inside your project repo, then:

```
/hall:doctor          — verify prerequisites and Hall connectivity
/hall:open            — start a session, load Old Major, pull advisory personas
/hall:plan            — design the project with Old Major (outputs plan.json)
/hall:dispatch        — create GitHub issues for ready tasks
/hall:status          — see task states (BACKLOG → IN_PROGRESS → DONE)
/hall:reconcile       — sync local plan.json with GitHub label changes
/hall:close           — wrap up, clean .hall-cache/
```

## Commands

| Command | What it does |
|---|---|
| `/hall:doctor` | Checks gh auth, token, Hall repo access, MCP health |
| `/hall:open` | Pulls personas + methodology from Hall, assembles session stack, starts watcher daemon |
| `/hall:plan` | Guided decomposition conversation with Old Major; writes `plan.json` |
| `/hall:dispatch` | Files issues for READY tasks (15 s apart to avoid invoker-pool races) |
| `/hall:status` | Renders task board from `plan.json` |
| `/hall:reconcile` | Pulls GitHub label changes → updates `plan.json` statuses |
| `/hall:consultations` | Routes a design question to the right specialist (Tier 1/2/3) |
| `/hall:reply` | Attaches a message to an in-flight task's GitHub issue |
| `/hall:prune` | Removes DONE/CANCELLED tasks from plan.json |
| `/hall:close` | Saves session notes, kills watcher, removes `.hall-cache/` |

## Environment

The plugin writes all session state under `.hall-cache/` (gitignored). Nothing is committed to your project repo.

```
.hall-cache/
  personas/          # pulled from Hall roster at /hall:open
  methodology/       # pulled from Hall at /hall:open
  session/
    claude-agents/   # rendered subagent overlays (one per specialist)
  plan.json          # task graph, updated by reconcile
  CLAUDE-stack.md    # assembled session prompt stack
  watcher.pid        # background sync daemon
  watcher.log
```

## Security

The `guard-writes` hook enforces that subagents can only write inside `.hall-cache/` and `.gitignore`. Writes to your project source tree are blocked by default.
