# Hall of Automata — Claude Code Plugin

Most AI coding tools work file by file, one change at a time. **Hall of Automata** works at project scale.

You open a session, describe what you want to build, and Old Major — an orchestrator running entirely inside Claude Code — designs the work, breaks it into tasks, and dispatches each task to a specialist AI agent. Every agent runs in its own autonomous Claude session, opens a pull request when done, and Old Major reviews and merges it. While agents are working, you can keep building. When they finish, Old Major syncs, unblocks the next wave, and keeps going.

This plugin brings that loop to completion: persistent session state, GitHub Issues as the coordination layer, automated review and merge, cross-invoker board sync, Google Drive context ingestion, and fully unattended operation. It is the bridge between a human team's intent and an AI team's execution — a methodology, not just a tool.

> **Dispatch mode requires a Hall of Automata instance** — a GitHub org with the [Hall of Automata GitHub App](https://github.com/marketplace/hall-of-automata) installed. Without one, Hall runs in **local mode**: Old Major plans and implements inline, inside your current Claude session, with no external agents.

---

## Prerequisites

Complete all four steps before installing.

### 1. Claude Code

Download and install Claude Code from [claude.ai/code](https://claude.ai/code). It runs as a desktop app on Mac and Windows, and as an extension for VS Code and JetBrains IDEs.

### 2. GitHub CLI

The GitHub CLI (`gh`) handles authentication between Claude and GitHub.

1. Go to [cli.github.com](https://cli.github.com) and download the installer for your operating system.
2. Run the installer — it doesn't require any configuration during install.
3. Authenticate by running this command in a terminal:
   ```
   gh auth login
   ```
   It opens a browser window and walks you through signing in to GitHub.

> **How to open a terminal:**
> - **Mac:** press `Cmd + Space`, type "Terminal", press Enter
> - **Windows:** press `Win + R`, type `cmd`, press Enter
> - **Inside Claude Code or VS Code:** press `` Ctrl+` `` to open the built-in terminal

### 3. GitHub Personal Access Token

Hall uses GitHub's API to read and write issues, pull requests, and project boards on your behalf. This requires a Personal Access Token added to Claude's settings.

**Step 1 — Create the token**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name it `Hall of Automata CLI`
4. Set an expiration (or choose **No expiration**)
5. Select exactly these scopes:

   | Scope | Why it's needed |
   |---|---|
   | ✅ `repo` | Read and write repositories — issues, pull requests, branches, code |
   | ✅ `read:org` | Read your organisation's team membership (used to verify invoker status) |
   | ✅ `project` | Create and update GitHub Projects v2 boards and fields |

6. Click **Generate token** and copy it immediately — it is only shown once. It starts with `ghp_`.

> This token has broad access to your repositories. Keep it private and do not share it.

**Step 2 — Add it to Claude's settings**

Locate Claude's global settings file on your computer:

| Operating system | File path |
|---|---|
| **Mac** | `~/.claude/settings.json` |
| **Windows** | `%APPDATA%\Claude\settings.json` — paste this directly into the address bar in File Explorer |
| **Linux** | `~/.claude/settings.json` |

Open the file in any text editor (Notepad works on Windows). Add an `env` section with your token. If the file already has content, add only the `env` block — don't replace what's there:

```json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
  }
}
```

Save and restart Claude Code.

### 4. Hall of Automata GitHub App

For dispatch mode, the [Hall of Automata GitHub App](https://github.com/marketplace/hall-of-automata) must be installed on the GitHub organisation that owns your target repository. An org owner can install it from the Marketplace page in a few clicks.

Skip this step if you are using local mode only.

---

## Installation

Inside any Claude Code session:

```
/plugin marketplace add MockaSort-Studio/marketplace
/plugin install hall-of-automata-cli@mockasort
```

Works in the desktop app, VS Code, JetBrains, and the CLI — no terminal or git required.

---

## Working with Hall

Hall is built around a **session** — an active working context that you open at the start of your work and close when you are done. Opening a session is intentional: it pulls personas, assembles the instruction stack, and starts the background watcher. It is not a fire-and-forget operation, and it is not meant to be opened and closed repeatedly.

**The typical flow:**

1. Open Claude Code in your project folder.
2. Run `/hall:open` — Old Major introduces himself and asks what you are building (or resumes a plan already in progress).
3. Have a conversation. Old Major helps you decompose the work, routes design questions to the right specialist, and proposes a dispatch plan.
4. Approve the dispatch. Hall files GitHub Issues for each task. Agents pick them up and start working.
5. Keep working on other things. Hall runs a background cron that automatically syncs task states, triggers reviews, and dispatches newly unblocked tasks.
6. Run `/hall:close` when you are done for the day. Hall saves session notes and shuts down cleanly.

**The commands most users need most of the time are `/hall:open` and `/hall:close`.** Everything else — status, reconcile, reply, prune — is there for fine-grained control when you want it.

---

## What Hall can do

**Manage projects end-to-end.** Old Major takes a description of what you want to build, designs the decomposition, routes tasks to the right specialists, and tracks everything from first issue to merged PR. You direct; Hall executes.

**Coordinate across a team.** If multiple invokers are working on the same Hall instance, the GitHub Projects v2 board keeps everyone in sync. Each invoker sees their own tasks; cross-invoker updates are posted as comments. Run `/hall:init-board` once on a repo to set up the coordination board.

**Ingest context from Google Drive.** Drop a spec, a design doc, or a set of meeting notes into Google Drive and point Old Major at them. Hall can read Drive files directly into the planning conversation — no copy-paste required.

**Work fully unattended.** With automation level 2 enabled at session open, Hall schedules a background cron that reconciles state, reviews PRs, and dispatches new work automatically. You can walk away and come back to merged pull requests.

---

## Command reference

| Command | What it does |
|---|---|
| `/hall:doctor` | Preflight check — gh auth, token, Hall App installation, MCP connectivity |
| `/hall:open` | Start a session: load Old Major, pull personas and methodology, start watcher |
| `/hall:plan` | Design conversation with Old Major; produces the task graph |
| `/hall:dispatch` | File GitHub Issues for ready tasks |
| `/hall:status` | Show current task states from the local plan |
| `/hall:reconcile` | Sync task states with GitHub — picks up label changes, PR merges, new reviews |
| `/hall:review` | Run the inline review loop — assess open PRs and settle or escalate |
| `/hall:init-board` | Provision the GitHub Projects v2 board, custom fields, and labels on the target repo |
| `/hall:consultations` | List, view, or prune saved Tier-2 consultation outputs |
| `/hall:reply` | Send a message to a task that is waiting for input |
| `/hall:prune` | Remove completed plans or stale cache; `--invoker` resets invoker verification |
| `/hall:close` | End the session — cancel cron, save notes, clean up |

---

## Security

A `guard-writes` hook runs before every file write during a session. AI agents are restricted to writing inside `~/.hall/` — a global directory outside your repository. Any attempt to write to your project's source tree is blocked before it executes.

---

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
