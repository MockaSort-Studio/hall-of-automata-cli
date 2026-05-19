# Hall of Automata — Claude Code Plugin

Local orchestrator for multi-task projects on a [Hall of Automata](https://github.com/MockaSort-Studio/hall-of-automata) instance. Plan decomposition, agent dispatch, and task coordination — all via a design conversation with Old Major.

## Prerequisites

- [Claude Code](https://claude.ai/code) CLI (`claude` / `cc`)
- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated to the org that hosts your Hall instance
- An org installed [Hall of Automata](https://github.com/marketplace/hall-of-automata) 
- `GITHUB_PERSONAL_ACCESS_TOKEN` set in your environment (required for MCP connectivity)

## Installation

### Via MockaSort Marketplace (recommended)

Inside any Claude Code session:

```
/plugin marketplace add MockaSort-Studio/marketplace
/plugin install hall-of-automata-cli@mockasort
```

Works in the CLI, desktop app, and IDE extensions — no git or terminal required.

### Manual (CLI only)

```bash
git clone https://github.com/MockaSort-Studio/hall-of-automata-cli
claude --plugin-dir /path/to/hall-of-automata-cli
```

To load permanently without the flag, add to `~/.claude/settings.json` (Linux/macOS) or `%APPDATA%\Claude\settings.json` (Windows):

```json
{
  "plugins": [
    { "path": "/path/to/hall-of-automata-cli" }
  ]
}
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

**First run:** on the first `/hall:open`, you'll be asked whether you are a Hall invoker (a member of the `automata-invokers` team on GitHub). Non-invokers get local orchestration mode — Old Major plans and implements inline without filing GitHub Issues. To re-verify after joining the team: `hall:prune --invoker` or pass `--verify` to `/hall:open`.

## Architecture

All GitHub API calls use the GitHub Copilot MCP server (`api.githubcopilot.com/mcp/`) as the primary path, with `gh api` REST calls as inline fallbacks for rate-limit errors. A companion hall-projects MCP server (`mcp/hall-projects-server.py`) handles Projects v2 board operations exclusively — the Copilot MCP has no Projects v2 tools, so this split is structural. The fallback convention is a comment immediately after each MCP call: `# On rate_limit/secondary-rate-limit error: gh api <endpoint>`. Session state lives entirely in `.hall-cache/` (gitignored); GitHub Issues are the coordination layer between Old Major and Hall specialists. See [docs/design.md §17](docs/design.md) for the full architectural rationale and the scope boundary between the two MCP servers.

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
| `/hall:prune` | Removes DONE/CANCELLED tasks from plan.json; `--invoker` resets invoker-status cache |
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
