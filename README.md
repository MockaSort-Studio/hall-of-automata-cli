# Hall of Automata — Claude Code Plugin

**Hall of Automata** is an AI project management system built on top of Claude Code. You describe what you want to build, and Old Major — an orchestrator persona — breaks the work into tasks, assigns each one to a specialist AI agent, and coordinates everything through GitHub Issues. Each specialist works autonomously in its own Claude session, opens a pull request when done, and Old Major reviews and merges the results.

This plugin is the local side of that system. It runs inside Claude Code and gives you the `/hall:*` commands to plan, dispatch, and track work across your project.

> **You need an active Hall of Automata instance** (a GitHub org with the [Hall of Automata GitHub App](https://github.com/marketplace/hall-of-automata) installed) to use dispatch mode. If you don't have one, Hall runs in **local mode**: Old Major plans and implements inline, without filing GitHub Issues.

---

## Prerequisites

Complete all four steps before installing the plugin.

### 1. Claude Code

Download and install Claude Code from [claude.ai/code](https://claude.ai/code). It is available as a desktop app for Mac and Windows, and as an extension for VS Code and JetBrains IDEs.

### 2. GitHub CLI

The GitHub CLI (`gh`) is a small program that lets Claude connect to GitHub on your behalf.

1. Go to [cli.github.com](https://cli.github.com) and download the installer for your operating system (Mac, Windows, or Linux).
2. Run the installer.
3. Open a terminal and run:
   ```
   gh auth login
   ```
   Follow the prompts — it will open a browser window and ask you to sign in to GitHub.

> **How to open a terminal:**
> - **Mac:** press `Cmd + Space`, type "Terminal", press Enter
> - **Windows:** press `Win + R`, type `cmd`, press Enter
> - **Claude Code desktop / VS Code:** use the built-in terminal (`` Ctrl+` ``)

### 3. GitHub Personal Access Token

The plugin uses GitHub's MCP server to read and write issues, pull requests, and project boards. This requires a Personal Access Token stored in Claude's global settings.

**Step 1 — Create a token**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) (sign in if needed)
2. Click **Generate new token (classic)**
3. Give it a name like `Hall of Automata CLI`
4. Set expiration to **No expiration** (or however long you prefer)
5. Select these scopes:
   - ✅ **`repo`** — required (read/write issues, pull requests, code)
   - ✅ **`read:org`** — recommended (needed to verify your invoker status)
6. Click **Generate token** and copy it — it starts with `ghp_`

> Keep this token private. Anyone with it can access your repositories.

**Step 2 — Add it to Claude's settings**

Open Claude's global settings file in a text editor:

| Operating system | File location |
|---|---|
| **Mac** | `~/.claude/settings.json` |
| **Windows** | `%APPDATA%\Claude\settings.json` *(paste this into the File Explorer address bar)* |
| **Linux** | `~/.claude/settings.json` |

Add an `env` block with your token. If the file already exists, merge this in — don't replace the whole file:

```json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
  }
}
```

Save the file and restart Claude Code.

### 4. Hall of Automata GitHub App

If you want dispatch mode (AI agents working in your GitHub repo), the [Hall of Automata GitHub App](https://github.com/marketplace/hall-of-automata) must be installed on your organization. An org owner can do this from the GitHub Marketplace page.

If you are only using local mode (Old Major works inline), skip this step.

---

## Installation

Inside any Claude Code session:

```
/plugin marketplace add MockaSort-Studio/marketplace
/plugin install hall-of-automata-cli@mockasort
```

This works in the desktop app, VS Code, JetBrains, and the CLI — no terminal or git required.

---

## Quick Start

Open a Claude Code session in your project's folder, then run:

```
/hall:doctor    — check that everything is set up correctly
/hall:open      — start a session and load Old Major
/hall:plan      — describe what you want to build; Old Major breaks it into tasks
/hall:dispatch  — send ready tasks to Hall specialists as GitHub Issues
/hall:status    — see the current state of all tasks
/hall:reconcile — sync task states with what's happened on GitHub
/hall:close     — end the session
```

On first `/hall:open`, you'll be asked whether you are a **Hall invoker** — a member of your org's `automata-invokers` team, which grants dispatch access. If you are not, Hall automatically switches to local mode.

---

## Commands

| Command | What it does |
|---|---|
| `/hall:doctor` | Runs a full preflight check — gh auth, token, Hall App installation, MCP health |
| `/hall:open` | Loads Old Major, pulls specialist personas and methodology from Hall, starts the session |
| `/hall:plan` | Design conversation with Old Major; produces a `plan.json` task graph |
| `/hall:dispatch` | Files GitHub Issues for tasks that are ready to go |
| `/hall:status` | Shows the current task board from `plan.json` |
| `/hall:reconcile` | Pulls GitHub label and PR state changes into the local task graph |
| `/hall:init-board` | Provisions the GitHub Projects v2 board, custom fields, and labels on the target repo |
| `/hall:consultations` | Routes a design question to the right specialist (Tier 1/2/3) |
| `/hall:reply` | Sends a message to a specialist whose task is waiting for input |
| `/hall:prune` | Removes old completed plans or stale cache; `--invoker` resets invoker verification |
| `/hall:close` | Ends the session, cancels the background cron, removes session files |

---

## How it works

All session state lives in `.hall-cache/` inside your project folder. This directory is gitignored — nothing from it is ever committed to your repo. GitHub Issues are the coordination layer between Old Major and Hall specialists.

```
.hall-cache/
  personas/              # specialist personas pulled from Hall at /hall:open
  methodology/           # Old Major's operating instructions
  plans/
    <date-plan-name>/
      plan.json          # task graph with statuses and GitHub issue numbers
      plan.md            # human-readable task board
  session/
    CLAUDE-stack.md      # assembled session instruction stack
    claude-agents/       # rendered specialist overlays (one per agent)
    config.json          # automation level and local/invoker mode
    roster-index.md      # index of available specialists
  watcher.pid            # background file-watch daemon PID
  watcher-events.jsonl   # events since last reconcile
```

All GitHub API calls go through the GitHub MCP server, with `gh api` REST calls as inline fallbacks for rate-limit errors. A companion `hall-projects` MCP server (`mcp/hall-projects-server.py`) handles Projects v2 board operations — the GitHub MCP has no Projects v2 tools, so this split is structural. See [docs/design.md](docs/design.md) for the full architectural rationale.

---

## Security

The `guard-writes` hook enforces that AI agents running inside the session can only write inside `.hall-cache/` and modify `.gitignore`. Any attempt to write to your project source tree is blocked before the tool call executes.

---

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
