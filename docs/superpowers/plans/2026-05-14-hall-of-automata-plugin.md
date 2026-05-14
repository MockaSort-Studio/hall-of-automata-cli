# Hall-of-Automata Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code plugin that gives Old Major a persistent local session to plan, dispatch, and coordinate multi-task projects on the Hall of Automata via GitHub Issues.

**Architecture:** A markdown-first Claude Code plugin — no compiled runtime. Skills are SKILL.md files, behavior is shaped by persona engineering + methodology markdown injected via CLAUDE.md @-import chain, and automation uses bash hooks. The only "code" is shell scripts for hooks and a background watcher daemon.

**Tech Stack:** Claude Code plugin system (SKILL.md, hooks, MCPs), bash shell scripts, `gh` CLI for all GitHub operations, JSON for plan/ledger data, Markdown for persona and methodology files.

---

## File Map

Files created in this plan, grouped by responsibility:

**Plugin manifest & MCPs**
- Create: `.claude-plugin/plugin.json`
- Create: `.mcp.json`

**Skills (user-invoked commands)**
- Create: `skills/hall-doctor/SKILL.md`
- Create: `skills/hall-open/SKILL.md`
- Create: `skills/hall-close/SKILL.md`
- Create: `skills/hall-status/SKILL.md`
- Create: `skills/hall-plan/SKILL.md`
- Create: `skills/hall-dispatch/SKILL.md`
- Create: `skills/hall-reply/SKILL.md`
- Create: `skills/hall-reconcile/SKILL.md`
- Create: `skills/hall-consultations/SKILL.md`
- Create: `skills/hall-prune/SKILL.md`

**Methodology (Old Major's injected instructions)**
- Create: `methodology/old-major-local-overlay.md`
- Create: `methodology/decomposition.md`
- Create: `methodology/consultation-router.md`
- Create: `methodology/routing-rationale.md`
- Create: `methodology/advisory-frameworks/tomashco.md`
- Create: `methodology/advisory-frameworks/frontenzo.md`
- Create: `methodology/advisory-frameworks/aeeeiii.md`

**Templates**
- Create: `templates/CLAUDE-stack.md.tpl`
- Create: `templates/subagents/tomashco.md.tpl`
- Create: `templates/subagents/frontenzo.md.tpl`
- Create: `templates/subagents/aeeeiii.md.tpl`
- Create: `templates/plan.json.schema`

**Hooks**
- Create: `hooks/hooks.json`
- Create: `hooks/scripts/guard-writes.sh`
- Create: `hooks/scripts/session-start.sh`
- Create: `hooks/scripts/watcher.sh`

**Tests**
- Create: `tests/hooks/test-guard-writes.sh`
- Create: `tests/hooks/test-session-start.sh`
- Create: `tests/hooks/test-watcher.sh`
- Create: `tests/validate-plugin.sh`

---

## Task 1: Plugin Scaffold

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.mcp.json`
- Create: `tests/validate-plugin.sh`

- [ ] **Step 1: Write the validation test**

```bash
# tests/validate-plugin.sh
#!/usr/bin/env bash
set -euo pipefail

PASS=0; FAIL=0

check() {
  local desc="$1"; local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "  PASS: $desc"; ((PASS++))
  else
    echo "  FAIL: $desc"; ((FAIL++))
  fi
}

echo "=== Plugin scaffold validation ==="
check "plugin.json exists"        "test -f .claude-plugin/plugin.json"
check "plugin.json valid JSON"    "python3 -m json.tool .claude-plugin/plugin.json"
check "plugin name is kebab-case" "python3 -c \"import json,re,sys; d=json.load(open('.claude-plugin/plugin.json')); sys.exit(0 if re.match(r'^[a-z][a-z0-9]*(-[a-z0-9]+)*$', d['name']) else 1)\""
check ".mcp.json exists"          "test -f .mcp.json"
check ".mcp.json valid JSON"      "python3 -m json.tool .mcp.json"
check "mcpServers has sequential-thinking" "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'sequential-thinking' in d else 1)\""
check "mcpServers has fetch"      "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'fetch' in d else 1)\""
check "mcpServers has github"     "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'github' in d else 1)\""

echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bash tests/validate-plugin.sh
```
Expected: FAIL — files don't exist yet.

- [ ] **Step 3: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "hall-of-automata",
  "version": "0.1.0",
  "description": "Persistent local orchestrator for multi-task projects on the Hall of Automata. Plan, dispatch, and coordinate specialist agents via a design conversation with Old Major.",
  "author": {
    "name": "Borys Cherny",
    "email": "mksetaro@gmail.com"
  },
  "repository": "https://github.com/MockaSort-Studio/hall-of-automata-cli",
  "license": "MIT",
  "keywords": ["hall-of-automata", "orchestration", "agents", "github-actions", "old-major"]
}
```

- [ ] **Step 4: Create `.mcp.json`**

```json
{
  "sequential-thinking": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
  },
  "fetch": {
    "command": "uvx",
    "args": ["mcp-server-fetch"]
  },
  "github": {
    "type": "http",
    "url": "https://api.githubcopilot.com/mcp/",
    "headers": {
      "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bash tests/validate-plugin.sh
```
Expected: 8 passed, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add .claude-plugin/plugin.json .mcp.json tests/validate-plugin.sh
git commit -m "feat: plugin scaffold — manifest and MCP servers"
```

---

## Task 2: Guard-Writes Hook

The most critical safety mechanism: prevents Old Major from writing code into the repo.

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/scripts/guard-writes.sh`
- Create: `tests/hooks/test-guard-writes.sh`

- [ ] **Step 1: Write the test**

```bash
# tests/hooks/test-guard-writes.sh
#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}/hooks/scripts/guard-writes.sh"
PASS=0; FAIL=0

run_hook() {
  local desc="$1"; local input="$2"; local expect_exit="$3"
  actual=$(echo "$input" | bash "$SCRIPT" 2>&1); actual_exit=$?
  if [ "$actual_exit" -eq "$expect_exit" ]; then
    echo "  PASS: $desc"; ((PASS++))
  else
    echo "  FAIL: $desc (got exit $actual_exit, wanted $expect_exit)"; echo "  output: $actual"; ((FAIL++))
  fi
}

echo "=== guard-writes hook tests ==="

# Should BLOCK writes to arbitrary repo paths
run_hook "blocks write to src/main.py" \
  '{"tool":"Write","tool_input":{"file_path":"src/main.py","content":"code"}}' 1

run_hook "blocks edit to README.md" \
  '{"tool":"Edit","tool_input":{"file_path":"README.md","old_string":"a","new_string":"b"}}' 1

# Should ALLOW writes inside .hall-cache/plans/*/plan.md
run_hook "allows write to plan.md" \
  '{"tool":"Write","tool_input":{"file_path":".hall-cache/plans/2026-05-14-test/plan.md","content":"# Plan"}}' 0

# Should ALLOW writes to .hall-cache/session/
run_hook "allows write to session stack" \
  '{"tool":"Write","tool_input":{"file_path":".hall-cache/session/CLAUDE-stack.md","content":"stack"}}' 0

# Should ALLOW writes to .hall-cache/personas/
run_hook "allows write to persona cache" \
  '{"tool":"Write","tool_input":{"file_path":".hall-cache/personas/old-major.md","content":"persona"}}' 0

# Should ALLOW writes to .gitignore (initial setup)
run_hook "allows write to .gitignore" \
  '{"tool":"Write","tool_input":{"file_path":".gitignore","content":".hall-cache/"}}' 0

echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bash tests/hooks/test-guard-writes.sh
```
Expected: FAIL — script doesn't exist yet.

- [ ] **Step 3: Create `hooks/scripts/guard-writes.sh`**

```bash
#!/usr/bin/env bash
# PreToolUse hook: block writes outside allowed paths.
# Reads a JSON object from stdin with keys: tool, tool_input.
# Exits 0 to allow, 1 to block.

set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool',''))")

# Only intercept write-type tools
case "$TOOL" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

FILE_PATH=$(echo "$INPUT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('file_path', ti.get('file_name', '')))")

# Normalize: strip leading ./
FILE_PATH="${FILE_PATH#./}"

# Allowed path patterns
allowed() {
  local p="$1"
  [[ "$p" == .hall-cache/* ]] && return 0
  [[ "$p" == .gitignore ]]     && return 0
  return 1
}

if allowed "$FILE_PATH"; then
  exit 0
fi

echo "BLOCKED: Old Major does not write to the repository. Writes are only permitted inside .hall-cache/. Attempted path: $FILE_PATH" >&2
exit 1
```

- [ ] **Step 4: Make script executable**

```bash
chmod +x hooks/scripts/guard-writes.sh
```

- [ ] **Step 5: Create `hooks/hooks.json`**

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/guard-writes.sh",
          "timeout": 10
        }
      ]
    }
  ]
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bash tests/hooks/test-guard-writes.sh
```
Expected: 6 passed, 0 failed.

- [ ] **Step 7: Commit**

```bash
git add hooks/ tests/hooks/test-guard-writes.sh
git commit -m "feat: guard-writes hook — block writes outside .hall-cache/"
```

---

## Task 3: Session-Start Hook

Detects interrupted sessions on startup and offers to resume.

**Files:**
- Modify: `hooks/hooks.json`
- Create: `hooks/scripts/session-start.sh`
- Create: `tests/hooks/test-session-start.sh`

- [ ] **Step 1: Write the test**

```bash
# tests/hooks/test-session-start.sh
#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}/hooks/scripts/session-start.sh"
PASS=0; FAIL=0
TMP=$(mktemp -d)

run_hook() {
  local desc="$1"; local repo_dir="$2"; local expect_pattern="$3"
  output=$(cd "$repo_dir" && bash "$SCRIPT" 2>&1)
  if echo "$output" | grep -q "$expect_pattern"; then
    echo "  PASS: $desc"; ((PASS++))
  else
    echo "  FAIL: $desc"; echo "  output: $output"; ((FAIL++))
  fi
}

echo "=== session-start hook tests ==="

# No session active — hook should be silent
NO_SESSION="$TMP/no-session"
mkdir -p "$NO_SESSION"
run_hook "silent when no active session" "$NO_SESSION" "^$"

# Active session detected — hook should print resume prompt
WITH_SESSION="$TMP/with-session"
mkdir -p "$WITH_SESSION/.hall-cache/session"
touch "$WITH_SESSION/.hall-cache/session/CLAUDE-stack.md"
run_hook "resume prompt when session stack exists" "$WITH_SESSION" "interrupted session"

# Gitignore missing — hook should warn
NO_GITIGNORE="$TMP/no-gitignore"
mkdir -p "$NO_GITIGNORE/.hall-cache/session"
touch "$NO_GITIGNORE/.hall-cache/session/CLAUDE-stack.md"
run_hook "warns when .gitignore missing" "$NO_GITIGNORE" "gitignore"

rm -rf "$TMP"
echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bash tests/hooks/test-session-start.sh
```
Expected: FAIL.

- [ ] **Step 3: Create `hooks/scripts/session-start.sh`**

```bash
#!/usr/bin/env bash
# SessionStart hook: detect interrupted sessions and gitignore state.
set -euo pipefail

STACK=".hall-cache/session/CLAUDE-stack.md"
GITIGNORE=".gitignore"

# Check gitignore (add .hall-cache/ if missing)
if [ -f "$STACK" ]; then
  if [ ! -f "$GITIGNORE" ] || ! grep -q "\.hall-cache" "$GITIGNORE" 2>/dev/null; then
    echo "WARNING: .hall-cache/ is not in .gitignore. Run /hall:open to fix this, or add it manually." >&2
  fi
fi

# Detect interrupted session
if [ -f "$STACK" ]; then
  echo "NOTE: An interrupted Old Major session was detected (.hall-cache/session/CLAUDE-stack.md exists). Run /hall:open to resume it, or /hall:close to clean it up." >&2
fi
```

- [ ] **Step 4: Make script executable**

```bash
chmod +x hooks/scripts/session-start.sh
```

- [ ] **Step 5: Add SessionStart entry to `hooks/hooks.json`**

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/guard-writes.sh",
          "timeout": 10
        }
      ]
    }
  ],
  "SessionStart": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.sh",
          "timeout": 10
        }
      ]
    }
  ]
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bash tests/hooks/test-session-start.sh
```
Expected: 3 passed, 0 failed.

- [ ] **Step 7: Commit**

```bash
git add hooks/hooks.json hooks/scripts/session-start.sh tests/hooks/test-session-start.sh
git commit -m "feat: session-start hook — resume detection and gitignore guard"
```

---

## Task 4: Methodology Files

These are the core prompt-engineering artifacts. Quality here determines how well Old Major behaves.

**Files:**
- Create: `methodology/old-major-local-overlay.md`
- Create: `methodology/decomposition.md`
- Create: `methodology/consultation-router.md`
- Create: `methodology/routing-rationale.md`
- Create: `methodology/advisory-frameworks/tomashco.md`
- Create: `methodology/advisory-frameworks/frontenzo.md`
- Create: `methodology/advisory-frameworks/aeeeiii.md`

- [ ] **Step 1: Create `methodology/old-major-local-overlay.md`**

This is the do/don't contract verbatim from the design document's "The local-mode overlay" section. Copy it exactly, adjusting only path references to use `${CLAUDE_PLUGIN_ROOT}`.

```markdown
# Old Major — Local Session Mode

You are operating outside the Hall, in a developer's local Claude Code session.

You retain your full persona (voice, judgment, refusal patterns) but operate
under additional local-scope constraints.

## Local rules

1. Your working area is `.hall-cache/` at the repo root. All durable session
   artifacts (plans, ledgers, saved consultations, fetched personas) live there.

2. `.hall-local.md` at the repo root is agent-owned — written by Hall-dispatched
   specialists during their runs. You may read it. You do not modify it.

3. Personas are fetched from `hall-of-automata` and cached. You do not author
   or edit them. If you believe upstream behavior is wrong, surface the
   disagreement; do not silently override.

4. Use the consultation router (`methodology/consultation-router.md`) to decide
   whether a specialist consultation runs inline, as a subagent, or as a Hall
   issue. Do not invent parallel routing heuristics.

5. Plans live in `.hall-cache/plans/<YYYY-MM-DD>-<slug>/`, append-only by date
   and slug. Do not overwrite prior plans; revisions produce a new folder or
   a diff appended to the existing plan.md.

## Do

- Open every project conversation with a clarifying-questions pass before
  proposing decomposition. Use the methodology in `decomposition.md`.

- Surface routing rationale explicitly when proposing a specialist for a task,
  using `routing-rationale.md`.

- Before any issue creation, present the dispatch plan and ask for explicit
  user confirmation. Summarize: count of issues in the ready set, specialists
  involved, estimated turn budget, dispatch order, inter-dispatch jitter (15s
  default, to respect the known invoker-pool race condition), and the current
  visible invoker pool capacity with a recommendation if the ready set exceeds it.

- Dispatch all tasks in the ready set as a batch (15s apart). Tasks held back
  by unmet dependencies stay in the local plan as BLOCKED and join the next
  ready set when their parents land.

- Act as the user's steward of Hall quota. When the ready set exceeds visible
  pool capacity, recommend filing up to capacity and holding the surplus as
  READY (deferred), releasing it as capacity opens. The user can override and
  fire everything, but the default is the steward path.

- When iteration with a specialist subagent exceeds 2 meaningful exchanges,
  propose escalating to a Hall issue so the Hall handles the conversation
  thread with proper task memory and durability.

- When a parent issue's PR merges (or an advising/researching parent's
  analysis is posted), identify the new ready set and propose filing it. Do
  not auto-file silently.

- After a substantive subagent consultation returns, propose saving it.
  Default path: `.hall-cache/plans/<plan>/consultations/`. Accept user-supplied
  alternative paths (`docs/`, `adr/`) when the consultation should become a
  committed project artifact.

- Sign substantive observations: — [🦅 Old Major (Session Mode)]

- Maintain your voice consistently: stately, measured, precise, dry, unsparing.

## Don't

- Don't write or commit code in this repo, except `.hall-cache/plans/<plan>/plan.md`
  and only with explicit user OK.

- Don't file `hall:dispatch-automaton` issues. Local triage replaces remote
  triage. Issues you file go directly to `hall:<specialist>`.

- Don't apply multiple `hall:<specialist>` labels to the same issue.

- Don't apply any `hall:*` label to a PR as a way to redirect work.

- Don't modify `hall:awaiting-input` or any Hall-managed state label.

- Don't dispatch a task whose parent is in Failed, Escalated, or carries
  `hall:post-mortem`. Pause descendants until resolution.

- Don't attempt to fix failing dispatches. When `hall:post-mortem` fires,
  the Hall's upstream Old Major handles the analysis. Wait for it.

- Don't update `.hall-cache/plans/<plan>/plan.md` silently. Propose changes
  in conversation; commit on user OK.

- Don't file advising or researching mode issues unless the consultation
  router determines they're needed. Most advisory work is inline or subagent.

- Don't poll GitHub aggressively. Respect rate limits.

## Code quality constraint

Include the following block in every doing-mode implementation issue body. Old Major is responsible for carrying this into every dispatch — it is not optional and is not left to the specialist's judgment.

> **Code quality:** All files produced by this task must be small enough for a human to review in one read (~200 lines hard ceiling). Prefer many small, focused files over fewer large ones. No duplicated logic. If a natural implementation would exceed this, decompose further and raise with Old Major before proceeding.
```

- [ ] **Step 2: Create `methodology/decomposition.md`**

```markdown
# Project Decomposition Methodology

To decompose a project into Hall-dispatchable tasks, follow this procedure in order.

## Phase 1: Clarifying questions

Before proposing any decomposition, identify ambiguities that would force you to make assumptions that could invalidate task design. Ask only about ambiguities that actually affect how work gets structured — not completeness for its own sake.

Categories to probe:
- **Scope edges:** What explicitly is and isn't included in this iteration?
- **Integration points:** Which existing systems does this touch? Are there schemas, APIs, or auth models to conform to?
- **Success criteria:** How will a Hall specialist know their task is done?
- **Constraints:** Tech stack requirements, performance targets, compliance requirements that narrow specialist choice.
- **Ordering assumptions:** Are there implicit dependencies the user hasn't stated (e.g., "the API needs to exist before the frontend")?

Keep the questions focused. Two to four is usually right; ten is never right.

## Phase 2: Task sizing

A well-sized Hall task:
- Can be understood from its issue body alone — the specialist doesn't need context beyond what's written
- Produces a single PR with a coherent diff
- Completes within a specialist's nominal turn budget (approximately 20-40 tool calls)
- Has a clear acceptance criterion

Signs a task is too large: the specialist would need to make significant architecture decisions, or the resulting PR would touch many unrelated files. Split it.

Signs a task is too small: it's a single function or config change a specialist would do in passing while completing a related task. Merge it.

## Phase 3: Dependency analysis

For each task, identify:
- **Hard dependencies:** Tasks whose output (a merged PR, a posted analysis) this task requires to start
- **Soft ordering preferences:** Tasks where the output of one helps the other but isn't strictly required

Only create hard dependency edges. Soft preferences are notes, not blockers.

Common dependency patterns:
- Schema / data model tasks block all tasks that read or write that schema
- API definition tasks block frontend tasks that consume the API
- CI/CD setup tasks block tasks that assume CI exists
- Research tasks block implementation tasks that depend on the research conclusion

## Phase 4: Specialist assignment

Assign each task to one specialist using `routing-rationale.md`. If a task spans multiple specialist domains, split it further or assign to the specialist whose domain dominates.

Never assign a single issue to multiple specialists (one `hall:<specialist>` label per issue).

## Phase 5: Plan presentation

Present the plan as:
1. A prose summary of the overall approach (2-3 sentences)
2. A task table: task title, specialist, dependencies (by task title), mode
3. A dependency diagram (Mermaid) showing the execution waves
4. The initial ready set (tasks with no dependencies) and estimated dispatch batch

Ask for explicit confirmation before filing anything.
```

- [ ] **Step 3: Create `methodology/consultation-router.md`**

```markdown
# Consultation Router

When Old Major needs specialist depth during a conversation, use this decision tree to choose the tier.

## Decision tree

```
Is the question shallow? (naming, sanity check, "does this feel right")
  └─ YES → Tier 1 (inline). Answer using advisory-frameworks/.
  └─ NO ↓

Does the question need sustained iteration (>2 exchanges likely) 
OR must the output be team-visible and durable (future reference, ADR, etc.)
OR does it need tools the prepacked MCPs don't provide (LSPs, deep repo introspection)?
  └─ YES → Tier 3 (Hall issue). File hall:<specialist>.
  └─ NO → Tier 2 (subagent). Spawn with upstream persona + subagent overlay.
```

## Tier 1 — Inline

Answer the question yourself using the loaded advisory frameworks.

Triggers: directory structure preferences, technology naming, "is this a reasonable approach", quick API surface sanity checks, "what would Tomashco say about this pattern".

Cost: just continued conversation.

**Failure mode to avoid:** escalating to Tier 2 for questions you can answer inline. Over-spawning subagents adds context overhead and slows the conversation.

## Tier 2 — Subagent

Spawn a one-shot subagent using the loaded specialist overlay from `.hall-cache/session/claude-agents/<specialist>.md`.

Triggers: substantive design analysis (architecture tradeoffs, data model review, performance analysis) that is private to this conversation and doesn't need to be committed anywhere.

**Iteration cap:** after 2 meaningful exchanges on the same topic with the same specialist, propose escalating to Tier 3. Subagents don't have task memory across invocations; a Hall issue thread handles sustained analysis properly.

After a substantive Tier 2 consultation, propose saving the output. Default: `.hall-cache/plans/<plan>/consultations/`. If the output should become a committed artifact (ADR, design note), accept a user-supplied path.

## Tier 3 — Hall issue

File a `hall:<specialist>` issue.

Always for: implementation work (doing mode — Hamlet, Pyrate, mergio, frontend implementation).

For advisory work (Tomashco, Frontenzo, aeeeiii) when:
- The analysis must be durable and team-visible
- Sustained iteration is expected
- The specialist needs tools the prepacked MCPs don't cover

## User overrides

The user can always override: "just file that as a research issue" or "what's your gut take" are both valid. Honor the override, note it in the plan if it affects routing rationale.
```

- [ ] **Step 4: Create `methodology/routing-rationale.md`**

```markdown
# Routing Rationale

When proposing a specialist assignment, record the reasoning explicitly — both in the pre-dispatch conversation and in the issue body. This replaces the audit trail that upstream Old Major would normally produce.

## Specialist roster and domains

| Specialist | Hall label | Domain | Notes |
|---|---|---|---|
| Hamlet | `hall:hamlet` | C++ | Systems-level C++, performance-critical code, memory management |
| Pyrate | `hall:pyrate` | Python | Python services, scripts, data pipelines, ML glue code |
| mergio | `hall:mergio` | CI/CD | GitHub Actions, Docker, deployment pipelines, infrastructure-as-code |
| Tomashco | `hall:tomashco` | Backend/systems design | Architecture review, API design, distributed systems (advisory or implementation) |
| Frontenzo | `hall:frontenzo` | Frontend critique | UI/UX review, accessibility, frontend architecture (advisory) |
| aeeeiii | `hall:aeeeiii` | Research | Literature review, technology comparison, deep-dive analysis |

## Assignment heuristics

**Language is the primary signal for implementation tasks.** If the task is "implement X in Python," Pyrate gets it. Don't over-think it.

**CI/CD is mergio's domain regardless of language.** A GitHub Actions workflow for a Python project goes to mergio, not Pyrate.

**For tasks that span domains, assign by the dominant work.** A task that's 80% Python with a small Actions change goes to Pyrate, who can handle the workflow file.

**Advisory specialists (Tomashco, Frontenzo, aeeeiii) take advisory or research tasks.** Implementation that happens to touch their domain (e.g., "build the REST API") goes to a language specialist, not Tomashco.

## Rationale format

In the dispatch confirmation summary, explain each assignment in one sentence:
> "Pyrate: pure Python service logic, no frontend surface, no infrastructure changes."
> "mergio: this task is entirely a CI pipeline addition, language-agnostic."

In the issue body, include a `## Routing` section:
```markdown
## Routing

Assigned to Pyrate. Rationale: this task implements the deduplication window in Python with no frontend surface, external API dependencies, or infrastructure changes. Pure Python logic within an existing service.
```

## What not to include in routing rationale

Don't explain the Hall's mechanics to the specialist (they already know them). Don't include meta-commentary about the routing decision itself. Keep it to why this specialist is right for this work.
```

- [ ] **Step 5: Create the three advisory framework files**

Create `methodology/advisory-frameworks/tomashco.md`:

```markdown
# Tomashco — Analytical Framework (Inline Reference)

Use this when handling Tier 1 (inline) advisory questions in Tomashco's domain: backend architecture, systems design, API design, distributed systems, data modeling.

## Analytical lenses Tomashco applies

**Data consistency first.** Before any architecture question, Tomashco asks: what are the consistency requirements? Eventual consistency is fine for many things; it's a disaster for others. Identify which before proposing a design.

**Failure mode analysis.** For any system component: what happens when it fails? What happens when it's slow? What happens when it fails silently? If you can't answer these, the design isn't ready.

**API surface minimalism.** The right API is the smallest one that solves the problem. Every method you add is a compatibility commitment. Every parameter you add is a parsing and validation obligation.

**Scalability honesty.** Distinguish between "works at current scale" and "scales." Both are valid answers; conflating them is not. State the ceiling explicitly.

## Questions Tomashco asks

- What are the read/write patterns? (Ratio, frequency, latency tolerance)
- What's the consistency model? (Strong, eventual, causal)
- What's the failure recovery model? (Retry, idempotency, dead letter)
- Where is the single source of truth for X?
- What breaks first under load?

## When to escalate to Tier 2 or Tier 3

Escalate when the question requires: detailed analysis of a specific codebase (Tier 3), sustained back-and-forth about a complex tradeoff (Tier 2 or Tier 3), or the output needs to be committed as an ADR (Tier 3).
```

Create `methodology/advisory-frameworks/frontenzo.md`:

```markdown
# Frontenzo — Analytical Framework (Inline Reference)

Use this when handling Tier 1 (inline) advisory questions in Frontenzo's domain: frontend architecture, UI/UX critique, accessibility, component design.

## Analytical lenses Frontenzo applies

**User first.** Every frontend decision traces back to what the user perceives and does. Performance matters because users perceive latency. Accessibility matters because users have diverse needs. Component architecture matters because it shapes what's possible to build.

**Component boundaries.** The right component is one that owns exactly what it displays and nothing more. State that leaks across component boundaries causes coupling; coupling causes bugs that are hard to locate.

**Performance budget.** Every asset, every render, every data fetch has a cost. Frontenzo tracks the budget. "It works" without "at what cost" is an incomplete answer.

**Accessibility as design constraint.** Accessibility is not a checklist item added at the end. It shapes component structure, keyboard interactions, ARIA semantics. If it's an afterthought, it's usually wrong.

## Questions Frontenzo asks

- What's the render model? (SSR, CSR, hybrid)
- Who owns this state and why?
- What's the keyboard/screen reader interaction model?
- What's the loading/error/empty state for this component?
- What happens on a slow connection?

## When to escalate to Tier 2 or Tier 3

Escalate when the question requires reviewing actual code or design files (Tier 2 or Tier 3), or when the output is a formal UX review the team should reference (Tier 3).
```

Create `methodology/advisory-frameworks/aeeeiii.md`:

```markdown
# aeeeiii — Analytical Framework (Inline Reference)

Use this when handling Tier 1 (inline) advisory questions in aeeeiii's domain: technology selection, research synthesis, literature review, trade-off analysis.

## Analytical lenses aeeeiii applies

**Evidence over intuition.** aeeeiii distinguishes between "conventional wisdom," "empirically supported," and "theoretical." Recommendations without evidence sources are opinions. Opinions can be right; label them correctly.

**Comparison framing.** Technology selection questions need a comparison frame. What are the alternatives? What are the selection criteria? What does each alternative score on each criterion? "X is better than Y" without this frame is noise.

**Scope of claims.** Research findings have scope conditions. A benchmark result for one workload doesn't generalize to all workloads. State the scope of any claim.

**Cost of investigation.** Some questions deserve a deep dive (file a Hall research issue). Some deserve a paragraph. Calibrate the response to the decision it's informing.

## Questions aeeeiii asks

- What decision is this research informing?
- What's the time horizon? (Research useful today vs. research for a 5-year bet)
- What are the alternative options already on the table?
- How sensitive is the decision to the answer? (High sensitivity → more thorough research)
- What's the cost of being wrong?

## When to escalate to Tier 2 or Tier 3

Escalate when the question requires: fetching and synthesizing multiple sources (Tier 2 with fetch MCP), or producing a durable research artifact for the team (Tier 3 Hall research issue).
```

- [ ] **Step 6: Commit**

```bash
git add methodology/
git commit -m "feat: Old Major methodology files — overlay, decomposition, consultation router, routing rationale, advisory frameworks"
```

---

## Task 5: Session Stack Template

**Files:**
- Create: `templates/CLAUDE-stack.md.tpl`
- Create: `templates/subagents/tomashco.md.tpl`
- Create: `templates/subagents/frontenzo.md.tpl`
- Create: `templates/subagents/aeeeiii.md.tpl`

- [ ] **Step 1: Create `templates/CLAUDE-stack.md.tpl`**

This template is rendered by `/hall:open` into `.hall-cache/session/CLAUDE-stack.md`. Variables: `{{PLUGIN_ROOT}}`, `{{CACHE_ROOT}}`.

```markdown
# Old Major — Session Stack

<!-- Assembled by /hall:open on {{ASSEMBLED_AT}} -->
<!-- Source plugin: {{PLUGIN_ROOT}} -->
<!-- Cache root: {{CACHE_ROOT}} -->

@{{CACHE_ROOT}}/personas/automaton_base.md

@{{CACHE_ROOT}}/personas/old-major.md

@{{CACHE_ROOT}}/methodology/old-major-local-overlay.md

@{{CACHE_ROOT}}/methodology/decomposition.md

@{{CACHE_ROOT}}/methodology/consultation-router.md

@{{CACHE_ROOT}}/methodology/routing-rationale.md

@{{CACHE_ROOT}}/methodology/advisory-frameworks/tomashco.md

@{{CACHE_ROOT}}/methodology/advisory-frameworks/frontenzo.md

@{{CACHE_ROOT}}/methodology/advisory-frameworks/aeeeiii.md
```

- [ ] **Step 2: Create the three subagent overlay templates**

`templates/subagents/tomashco.md.tpl`:

```markdown
---
description: Tomashco — backend and systems design specialist. Use for substantive architecture analysis, API design review, data modeling, distributed systems tradeoffs. One-shot consultation: produce analysis and return to Old Major.
model: claude-opus-4-7
tools: [Read, Glob, Grep, WebFetch]
---

@{{CACHE_ROOT}}/personas/automaton_base.md

@{{CACHE_ROOT}}/personas/tomashco.md

# Local consultation overlay

You are operating as a one-shot advisory consultant to Old Major in a local Claude Code session.

Your task is the analysis question Old Major has given you. Produce your analysis, then end with a clear summary block starting with `## Analysis summary`.

Do not ask follow-up questions. Do not take action. Do not write code. Analyze and advise.

If this is your second or third exchange on the same topic, end with: `— This analysis has reached the Tier-2 iteration cap. Old Major should consider escalating this to a Hall research or advising issue if the question needs more depth.`
```

`templates/subagents/frontenzo.md.tpl`: same structure, substituting `frontenzo` for `tomashco` and adjusting the description to "frontend critique specialist. Use for UI/UX review, component architecture analysis, accessibility review, frontend performance."

`templates/subagents/aeeeiii.md.tpl`: same structure, substituting `aeeeiii` and adjusting description to "research and synthesis specialist. Use for technology comparison, literature synthesis, trade-off analysis."

- [ ] **Step 3: Commit**

```bash
git add templates/
git commit -m "feat: session stack and subagent overlay templates"
```

---

## Task 6: Plan JSON Schema

**Files:**
- Create: `templates/plan.json.schema`

- [ ] **Step 1: Create `templates/plan.json.schema`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Hall Plan",
  "type": "object",
  "required": ["id", "created_at", "repo", "tasks"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}-.+$",
      "description": "YYYY-MM-DD-<slug>"
    },
    "created_at": { "type": "string", "format": "date-time" },
    "repo": {
      "type": "string",
      "pattern": "^[^/]+/[^/]+$",
      "description": "org/repo"
    },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title", "specialist", "mode", "status"],
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "specialist": {
            "type": "string",
            "enum": ["hamlet", "pyrate", "mergio", "tomashco", "frontenzo", "aeeeiii"]
          },
          "mode": {
            "type": "string",
            "enum": ["doing", "advising", "researching"]
          },
          "status": {
            "type": "string",
            "enum": ["PLANNED", "READY", "DISPATCHED", "IN_PROGRESS", "AWAITING_INPUT", "MERGED", "FAILED", "BLOCKED", "ESCALATED"]
          },
          "github_issue": { "type": ["integer", "null"] },
          "github_pr": { "type": ["integer", "null"] },
          "depends_on": {
            "type": "array",
            "items": { "type": "string" },
            "description": "List of task IDs that must reach MERGED (or analysis posted) before this task can be dispatched"
          },
          "routing_rationale": { "type": "string" },
          "issue_body": { "type": "string" }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Add schema validation to test suite**

```bash
# Add to tests/validate-plugin.sh, inside the checks block:
check "plan.json.schema is valid JSON"  "python3 -m json.tool templates/plan.json.schema"
```

- [ ] **Step 3: Commit**

```bash
git add templates/plan.json.schema tests/validate-plugin.sh
git commit -m "feat: plan.json schema definition"
```

---

## Task 7: `/hall:doctor` Command

The preflight diagnostic — first command to build because it validates the environment every other command depends on.

**Files:**
- Create: `skills/hall-doctor/SKILL.md`

- [ ] **Step 1: Create `skills/hall-doctor/SKILL.md`**

```markdown
---
name: hall-doctor
description: Short description for /help — runs full preflight diagnostics for the Hall of Automata plugin
argument-hint: [--fix]
allowed-tools: [Bash, Read]
---

# /hall:doctor

Run a full preflight diagnostic of the Hall of Automata environment. Use `--fix` to automatically repair issues that can be fixed (missing gitignore entry, stale cache).

## Checks to run

Run all checks and display results as a table. Mark each ✓ (pass), ✗ (fail — blocks session), or ⚠ (warn — session possible but degraded).

### 1. gh CLI authentication (✗ if fails)

```bash
gh auth status
```

Parse for "Logged in to github.com". Fail if not authenticated.

### 2. GITHUB_PERSONAL_ACCESS_TOKEN set (⚠ if missing)

```bash
echo "${GITHUB_PERSONAL_ACCESS_TOKEN:-NOT_SET}"
```

The GitHub MCP needs this. Warn if missing; the session works without it but the GitHub MCP won't connect.

### 3. Hall App installed on target repo's org (✗ if fails)

```bash
gh api /repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/installation 2>&1
```

If this returns 404, the Hall App is not installed on this repo's org. The plugin cannot dispatch without it.

### 4. User is a Hall invoker (⚠ if fails — plan-only mode)

```bash
gh api /repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/collaborators/$(gh api /user -q .login) 2>&1
```

Check for write access (push permission). Without it, dispatch is blocked but plan creation works.

### 5. .hall-cache/ in .gitignore (⚠ if missing, fix with --fix)

```bash
grep -q "\.hall-cache" .gitignore 2>/dev/null && echo "present" || echo "missing"
```

If `--fix` passed, append `.hall-cache/` to `.gitignore`.

### 6. Persona cache freshness (⚠ if stale or missing)

```bash
cat .hall-cache/personas/.fetched_at 2>/dev/null || echo "not cached"
```

Warn if the timestamp is >24h ago or the file doesn't exist.

### 7. MCP connectivity (⚠ for each failed server)

Run `claude mcp list` and check for ✓ Connected status on `sequential-thinking`, `fetch`, and `github`.

### 8. Hall quota (informational)

```bash
gh api /repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/issues \
  --jq '[.[] | select(.labels[].name | startswith("hall:")) | select(.state=="open")] | length'
```

Count open Hall issues on this repo (rough proxy for in-flight work). Display as info; not a pass/fail.

## Output format

Display as a two-column table: check name and result. End with a summary line:

```
✓ 6/8 checks passed  ⚠ 2 warnings  ✗ 0 blockers

Ready to /hall:open.
```

or

```
✓ 5/8 checks passed  ⚠ 1 warning  ✗ 2 blockers

Cannot start session: gh authentication required, Hall App not installed.
```
```

- [ ] **Step 2: Verify skill is discovered by running the plugin locally**

```bash
cc --plugin-dir . --debug 2>&1 | grep -i "hall-doctor"
```
Expected: skill appears in discovery output.

- [ ] **Step 3: Commit**

```bash
git add skills/hall-doctor/
git commit -m "feat: /hall:doctor preflight diagnostic command"
```

---

## Task 8: `/hall:open` Command

**Files:**
- Create: `skills/hall-open/SKILL.md`

- [ ] **Step 1: Create `skills/hall-open/SKILL.md`**

```markdown
---
name: hall-open
description: Short description for /help — enter Old Major session mode
argument-hint: [--refresh]
allowed-tools: [Bash, Read, Write]
---

# /hall:open

Enter Hall session mode. Fetches personas, assembles the Old Major stack, and activates it in the current session.

Use `--refresh` to force a persona re-fetch even if the cache is fresh.

## Execution sequence

Execute each step in order. Stop and report clearly if any step fails.

### Step 1: Preflight

Run the same checks as `/hall:doctor`. Hard-stop on:
- gh not authenticated
- Hall App not installed on this repo's org

Warn and continue on:
- `GITHUB_PERSONAL_ACCESS_TOKEN` not set (MCP won't connect; gh CLI still works)
- User not in invoker pool (note: plan-only mode, no dispatch)

### Step 2: Gitignore

```bash
if ! grep -q "\.hall-cache" .gitignore 2>/dev/null; then
  echo ".hall-cache/" >> .gitignore
  echo "Added .hall-cache/ to .gitignore"
fi
```

### Step 3: Persona fetch

Check cache freshness:
```bash
FETCHED_AT=$(cat .hall-cache/personas/.fetched_at 2>/dev/null || echo "")
NOW=$(date +%s)
```

If `--refresh` was passed OR `$FETCHED_AT` is empty OR it's >86400 seconds old, fetch:

```bash
mkdir -p .hall-cache/personas

# Fetch automaton_base.md
gh api repos/MockaSort-Studio/hall-of-automata/contents/agents/automaton_base.md \
  --jq '.content' | base64 -d > .hall-cache/personas/automaton_base.md

# Fetch old-major.md
gh api repos/MockaSort-Studio/hall-of-automata/contents/roster/old-major.md \
  --jq '.content' | base64 -d > .hall-cache/personas/old-major.md

# Fetch advisory specialist personas
for SPECIALIST in tomashco frontenzo aeeeiii; do
  gh api "repos/MockaSort-Studio/hall-of-automata/contents/roster/${SPECIALIST}.md" \
    --jq '.content' | base64 -d > ".hall-cache/personas/${SPECIALIST}.md"
done

date -u +"%Y-%m-%dT%H:%M:%SZ" > .hall-cache/personas/.fetched_at
echo "Personas fetched and cached."
```

### Step 4: Methodology copy

```bash
mkdir -p .hall-cache/methodology/advisory-frameworks
cp "${CLAUDE_PLUGIN_ROOT}/methodology/"*.md .hall-cache/methodology/
cp "${CLAUDE_PLUGIN_ROOT}/methodology/advisory-frameworks/"*.md .hall-cache/methodology/advisory-frameworks/
```

### Step 5: Subagent generation

For each advisory specialist (tomashco, frontenzo, aeeeiii), render the template:

```bash
mkdir -p .hall-cache/session/claude-agents
for SPECIALIST in tomashco frontenzo aeeeiii; do
  sed "s|{{CACHE_ROOT}}|.hall-cache|g" \
    "${CLAUDE_PLUGIN_ROOT}/templates/subagents/${SPECIALIST}.md.tpl" \
    > ".hall-cache/session/claude-agents/${SPECIALIST}.md"
done
```

### Step 6: Stack assembly

```bash
ASSEMBLED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
sed \
  -e "s|{{PLUGIN_ROOT}}|${CLAUDE_PLUGIN_ROOT}|g" \
  -e "s|{{CACHE_ROOT}}|.hall-cache|g" \
  -e "s|{{ASSEMBLED_AT}}|${ASSEMBLED_AT}|g" \
  "${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE-stack.md.tpl" \
  > .hall-cache/session/CLAUDE-stack.md
```

### Step 7: CLAUDE.md injection

Check workspace root for an existing `CLAUDE.md`:

```bash
IMPORT_LINE="@.hall-cache/session/CLAUDE-stack.md"
if [ ! -f CLAUDE.md ]; then
  echo "$IMPORT_LINE" > CLAUDE.md
  echo "Created CLAUDE.md with session stack import."
elif grep -qF "$IMPORT_LINE" CLAUDE.md; then
  echo "CLAUDE.md already has session stack import — no-op."
else
  echo "WARNING: A CLAUDE.md already exists without the Hall stack import."
  echo "To activate Old Major on next session start, append this line to your CLAUDE.md:"
  echo "  $IMPORT_LINE"
  echo "Or run: echo '$IMPORT_LINE' >> CLAUDE.md"
fi
```

### Step 8: Context injection (in-session activation)

Read and apply the assembled stack directly so Old Major activates now, without a restart:

Read `.hall-cache/session/CLAUDE-stack.md` and all files it @-imports, in order. Apply them as your operating instructions for this session.

Then read and apply:
- `.hall-cache/methodology/old-major-local-overlay.md`
- `.hall-cache/methodology/decomposition.md`
- `.hall-cache/methodology/consultation-router.md`
- `.hall-cache/methodology/routing-rationale.md`
- `.hall-cache/methodology/advisory-frameworks/tomashco.md`
- `.hall-cache/methodology/advisory-frameworks/frontenzo.md`
- `.hall-cache/methodology/advisory-frameworks/aeeeiii.md`

### Step 9: Check for existing plans

```bash
ls .hall-cache/plans/ 2>/dev/null || true
```

If plans exist, list them and ask whether to resume an existing plan or start fresh.

### Step 10: Show banner

Old Major introduces himself and asks what the user wants to build.
```

- [ ] **Step 2: Commit**

```bash
git add skills/hall-open/
git commit -m "feat: /hall:open command — session lifecycle entry"
```

---

## Task 9: `/hall:close` Command

**Files:**
- Create: `skills/hall-close/SKILL.md`

- [ ] **Step 1: Create `skills/hall-close/SKILL.md`**

```markdown
---
name: hall-close
description: Short description for /help — exit Old Major session mode and clean up session files
allowed-tools: [Bash, Write]
---

# /hall:close

Exit Hall session mode. Cleans up session files; leaves plans and persona cache intact.

## Execution sequence

### Step 1: Remove CLAUDE.md (or import line)

```bash
IMPORT_LINE="@.hall-cache/session/CLAUDE-stack.md"

if [ -f CLAUDE.md ]; then
  content=$(cat CLAUDE.md)
  if [ "$content" = "$IMPORT_LINE" ]; then
    # File was created by /hall:open — remove it entirely
    rm CLAUDE.md
    echo "Removed session CLAUDE.md."
  else
    # File has pre-existing content — remove only the import line
    grep -v "$IMPORT_LINE" CLAUDE.md > CLAUDE.md.tmp && mv CLAUDE.md.tmp CLAUDE.md
    echo "Removed Hall stack import line from CLAUDE.md."
  fi
fi
```

### Step 2: Kill watcher daemon

```bash
if [ -f .hall-cache/watcher.pid ]; then
  PID=$(cat .hall-cache/watcher.pid)
  kill "$PID" 2>/dev/null && echo "Stopped watcher (PID $PID)." || echo "Watcher was not running."
  rm .hall-cache/watcher.pid
fi
```

### Step 3: Remove session files

```bash
rm -f .hall-cache/session/CLAUDE-stack.md
rm -rf .hall-cache/session/claude-agents/
echo "Session files cleaned up."
```

### Step 4: Confirm

Confirm to the user that the session is closed. Note that plans and persona cache are intact for next time.

Return to normal Claude Code operation.
```

- [ ] **Step 2: Commit**

```bash
git add skills/hall-close/
git commit -m "feat: /hall:close command — session lifecycle exit"
```

---

## Task 10: Plan Management Commands

**Files:**
- Create: `skills/hall-status/SKILL.md`
- Create: `skills/hall-plan/SKILL.md`
- Create: `skills/hall-reconcile/SKILL.md`

- [ ] **Step 1: Create `skills/hall-status/SKILL.md`**

```markdown
---
name: hall-status
description: Short description for /help — render the current plan board
allowed-tools: [Bash, Read]
---

# /hall:status

Render the current plan board on demand.

## Execution

Find the active plan (most recent in `.hall-cache/plans/` by directory name):

```bash
ls -d .hall-cache/plans/*/ 2>/dev/null | sort | tail -1
```

Read `plan.json` and render a board grouped by status:

**In progress** — DISPATCHED or IN_PROGRESS tasks, with issue numbers and links
**Awaiting input** — AWAITING_INPUT tasks, with the question the specialist asked
**Blocked** — BLOCKED tasks, with what they're waiting for
**Ready to dispatch** — PLANNED tasks whose dependencies are all MERGED
**Done** — MERGED tasks (collapsed to count unless `--verbose`)
**Failed** — FAILED or ESCALATED tasks

End with a summary line: `N tasks in flight · M blocked · K merged · P failed`

If no active plan exists, say so and suggest running `/hall:open` to start one.
```

- [ ] **Step 2: Create `skills/hall-plan/SKILL.md`**

```markdown
---
name: hall-plan
description: Short description for /help — dump the current plan as JSON, Markdown, and Mermaid diagram
argument-hint: [--format json|md|mermaid]
allowed-tools: [Read, Bash]
---

# /hall:plan

Force-dump the current plan. Default: all three formats. Use `--format` to select one.

## Execution

Find the active plan and read its `plan.json`.

**JSON output:** Print `plan.json` contents.

**Markdown output:** Print `plan.md` contents (the human-readable rendering).

**Mermaid output:** Generate a dependency diagram:

```
flowchart LR
  t1["Task 1 title\nPyrate · MERGED"] --> t3["Task 3 title\nmergio · PLANNED"]
  t2["Task 2 title\nHamlet · IN_PROGRESS"] --> t3
  t1 --> t4["Task 4 title\nTomashco · PLANNED"]
```

Color nodes by status: MERGED=green, IN_PROGRESS=blue, AWAITING_INPUT=yellow, BLOCKED=gray, FAILED=red, PLANNED=white.
```

- [ ] **Step 3: Create `skills/hall-reconcile/SKILL.md`**

```markdown
---
name: hall-reconcile
description: Short description for /help — resync local plan state from GitHub (runs automatically before any dispatch)
allowed-tools: [Bash, Read, Write]
---

# /hall:reconcile

Resync the local plan with GitHub's current state. Runs automatically before any dispatch; can be invoked manually.

## Execution

Find the active plan. For each task with a `github_issue` number:

```bash
PLAN_DIR=$(ls -d .hall-cache/plans/*/ | sort | tail -1)
# For each issue:
gh issue view <N> --repo <ORG/REPO> --json state,labels,comments,url
```

Update task status based on issue state and labels:

| GitHub state | Labels | → Plan status |
|---|---|---|
| open | `hall:in-progress` | IN_PROGRESS |
| open | `hall:awaiting-input` | AWAITING_INPUT |
| open | `hall:post-mortem` | FAILED |
| open | `hall:invoker-queued` | DISPATCHED (queued) |
| closed | linked PR merged | MERGED |
| closed | no linked PR | FAILED |

If a PR associated with a MERGED issue has its own `merged_at` value, record it in the task entry.

After updating all tasks, identify any newly-eligible tasks (tasks whose `depends_on` entries are all now MERGED) and update them from PLANNED to READY (deferred).

Write the updated `plan.json`.

If GitHub wins on any conflict (task shows MERGED on GitHub but DISPATCHED locally), report the discrepancy and apply the GitHub state.

End with a reconciliation summary: N tasks updated, M newly eligible.
```

- [ ] **Step 4: Commit**

```bash
git add skills/hall-status/ skills/hall-plan/ skills/hall-reconcile/
git commit -m "feat: plan management commands — status, plan dump, reconcile"
```

---

## Task 11: Dispatch Command

**Files:**
- Create: `skills/hall-dispatch/SKILL.md`

- [ ] **Step 1: Create `skills/hall-dispatch/SKILL.md`**

```markdown
---
name: hall-dispatch
description: Short description for /help — dispatch ready tasks to the Hall as GitHub Issues
argument-hint: [--single <task_id>] [--dry-run]
allowed-tools: [Bash, Read, Write]
---

# /hall:dispatch

Dispatch ready tasks to the Hall. Old Major normally proposes this in conversation after showing the confirmation summary; use this command for explicit control.

- `--single <task_id>`: dispatch one specific task regardless of ready-set state
- `--dry-run`: preview the issues that would be created without filing them

## Execution

### Step 1: Reconcile

Run the reconcile procedure from `/hall:reconcile` before proceeding.

### Step 2: Determine the ready set

Tasks with status READY (deferred) or PLANNED whose `depends_on` entries are all MERGED.

If `--single` is specified, use only that task (verify it's in a dispatchable state).

### Step 3: Check quota

```bash
# Count open Hall issues on this repo (rough pool usage proxy)
gh issue list --repo <ORG/REPO> \
  --label "hall:in-progress" --json number | jq length
```

If the ready set exceeds estimated available capacity, display:
> "N tasks ready, estimated pool capacity is M. Recommend filing M now and holding N-M as deferred. Proceed with recommendation, or file all N?"

Default: the steward path (file up to capacity).

### Step 4: Confirmation summary

Display before any filing:

```
Ready to dispatch N tasks:

  Task 1 title → Pyrate (hall:pyrate) [doing]
    Routing: pure Python service logic, no infrastructure changes.
  Task 2 title → mergio (hall:mergio) [doing]
    Routing: entirely a CI pipeline addition.

Dispatch order: Task 1 at T+0, Task 2 at T+15s (15s inter-dispatch jitter).
Estimated turn budget: ~40 turns per task.

Proceed? [y/N]
```

If `--dry-run`, show the confirmation summary and the issue bodies that would be created, then stop.

### Step 5: File issues

For each task in dispatch order, spaced 15 seconds apart:

```bash
gh issue create \
  --repo <ORG/REPO> \
  --title "<task title>" \
  --label "hall:<specialist>" \
  --body "<issue body>"
```

Issue body format:
```markdown
<!-- Hall dispatch by Old Major (Session Mode) -->

## Summary

<one paragraph description of the task>

## Acceptance criteria

<what done looks like>

## Context

<relevant context the specialist needs — existing code references, design decisions, constraints>

## Routing

Assigned to <Specialist>. Rationale: <routing_rationale text>

## Dependencies

<list of parent tasks that have completed, with their PR links>

## Code quality

All files produced by this task must be small enough for a human to review in one read (~200 lines hard ceiling). Prefer many small, focused files over fewer large ones. No duplicated logic. If a natural implementation would exceed this, decompose further and raise with Old Major before proceeding.
```

After filing, update task status in `plan.json` to DISPATCHED and record `github_issue` number.

### Step 6: Report

```
Dispatched N tasks:
  Issue #142 → Task 1 title (Pyrate)
  Issue #143 → Task 2 title (mergio) [filed at T+15s]

M tasks remain blocked on: [dependency list]
```
```

- [ ] **Step 2: Commit**

```bash
git add skills/hall-dispatch/
git commit -m "feat: /hall:dispatch command — parallel dispatch with quota stewardship"
```

---

## Task 12: Remaining Commands

**Files:**
- Create: `skills/hall-reply/SKILL.md`
- Create: `skills/hall-consultations/SKILL.md`
- Create: `skills/hall-prune/SKILL.md`

- [ ] **Step 1: Create `skills/hall-reply/SKILL.md`**

```markdown
---
name: hall-reply
description: Short description for /help — post a reply on a task awaiting input, triggering re-dispatch
argument-hint: <task_id> <message>
allowed-tools: [Bash, Read]
---

# /hall:reply <task_id> <message>

Post a reply on a Hall issue that is carrying `hall:awaiting-input`, providing the information the specialist asked for. This triggers the specialist to re-run.

## Execution

Find the task by ID in the active plan. Retrieve the `github_issue` number.

```bash
gh issue comment <ISSUE_NUMBER> \
  --repo <ORG/REPO> \
  --body "<message>

— [🦅 Old Major (Session Mode)]"
```

Update task status in `plan.json` from AWAITING_INPUT back to IN_PROGRESS.

Confirm: `Replied to issue #N. The specialist will resume on next dispatch cycle.`
```

- [ ] **Step 2: Create `skills/hall-consultations/SKILL.md`**

```markdown
---
name: hall-consultations
description: Short description for /help — list, view, or prune saved Tier-2 subagent consultations
argument-hint: [list|view <id>|prune [--older-than <days>]]
allowed-tools: [Read, Bash, Write]
---

# /hall:consultations [list|view <id>|prune]

Manage saved Tier-2 subagent consultation outputs.

## list (default)

```bash
find .hall-cache/plans -name "*.md" -path "*/consultations/*" | sort
```

Display as a table: plan, filename, approximate size, date.

## view <id>

Read and display the consultation file. `<id>` can be a filename or a partial match.

## prune [--older-than <days>]

Remove consultation files older than N days (default: 90). List files to be removed and ask for confirmation before deleting.
```

- [ ] **Step 3: Create `skills/hall-prune/SKILL.md`**

```markdown
---
name: hall-prune
description: Short description for /help — clean up old plan directories or stale persona cache
argument-hint: [--plans <age-in-days>] [--cache]
allowed-tools: [Bash, Write]
---

# /hall:prune

Clean up older plans or stale cache from `.hall-cache/`.

## --plans <days>

List plan directories older than N days. Show sizes. Ask for confirmation before removing.

```bash
find .hall-cache/plans -maxdepth 1 -type d -mtime +<N> | sort
```

Never prune the most recent plan regardless of age.

## --cache

Remove `.hall-cache/personas/` (forces a fresh fetch on next `/hall:open`).

```bash
rm -rf .hall-cache/personas/
echo "Persona cache cleared. Next /hall:open will re-fetch."
```
```

- [ ] **Step 4: Commit**

```bash
git add skills/hall-reply/ skills/hall-consultations/ skills/hall-prune/
git commit -m "feat: remaining commands — reply, consultations, prune"
```

---

## Task 13: Watcher Daemon

Background GitHub polling for in-flight tasks.

**Files:**
- Create: `hooks/scripts/watcher.sh`
- Create: `tests/hooks/test-watcher.sh`
- Modify: `hooks/hooks.json` (add Stop hook to kill watcher on session end)

- [ ] **Step 1: Write the test**

```bash
# tests/hooks/test-watcher.sh
#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}/hooks/scripts/watcher.sh"
PASS=0; FAIL=0
TMP=$(mktemp -d)

echo "=== watcher daemon tests ==="

# Test: watcher writes PID file on start
check() {
  local desc="$1"; local cmd="$2"
  if eval "$cmd" &>/dev/null; then echo "  PASS: $desc"; ((PASS++))
  else echo "  FAIL: $desc"; ((FAIL++)); fi
}

mkdir -p "$TMP/.hall-cache"
(cd "$TMP" && POLL_INTERVAL=1 bash "$SCRIPT" --once &)
sleep 2
check "watcher creates PID file" "test -f $TMP/.hall-cache/watcher.pid"
PID=$(cat "$TMP/.hall-cache/watcher.pid" 2>/dev/null || echo 0)
kill "$PID" 2>/dev/null || true
check "watcher PID was a real process" "[ '$PID' -gt 0 ]"

rm -rf "$TMP"
echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bash tests/hooks/test-watcher.sh
```
Expected: FAIL.

- [ ] **Step 3: Create `hooks/scripts/watcher.sh`**

```bash
#!/usr/bin/env bash
# Background GitHub polling daemon for in-flight Hall tasks.
# Writes .hall-cache/watcher.pid on start.
# Polls every POLL_INTERVAL seconds (default 120).
# Pass --once to run a single check and exit (useful for testing).

set -euo pipefail

POLL_INTERVAL="${POLL_INTERVAL:-120}"
ONCE=false
[[ "${1:-}" == "--once" ]] && ONCE=true

CACHE=".hall-cache"
PID_FILE="$CACHE/watcher.pid"
PLAN_DIR=$(ls -d "$CACHE/plans/"*/ 2>/dev/null | sort | tail -1 || echo "")

# Write PID file
echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT

check_once() {
  [ -z "$PLAN_DIR" ] && return
  PLAN_JSON="$PLAN_DIR/plan.json"
  [ -f "$PLAN_JSON" ] || return

  REPO=$(python3 -c "import json; d=json.load(open('$PLAN_JSON')); print(d['repo'])" 2>/dev/null || echo "")
  [ -z "$REPO" ] && return

  # Check each dispatched or in-progress task
  python3 << PYEOF
import json, subprocess, sys

with open('$PLAN_JSON') as f:
    plan = json.load(f)

events = []
for task in plan.get('tasks', []):
    if task.get('status') not in ('DISPATCHED', 'IN_PROGRESS', 'AWAITING_INPUT'):
        continue
    issue = task.get('github_issue')
    if not issue:
        continue
    try:
        result = subprocess.run(
            ['gh', 'issue', 'view', str(issue), '--repo', '$REPO',
             '--json', 'state,labels,title,url'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            continue
        data = json.loads(result.stdout)
        labels = [l['name'] for l in data.get('labels', [])]
        if 'hall:awaiting-input' in labels and task['status'] != 'AWAITING_INPUT':
            events.append(f"AWAITING_INPUT: Issue #{issue} ({task['title']}) needs your input.")
        if data['state'] == 'closed' and task['status'] not in ('MERGED', 'FAILED'):
            events.append(f"CLOSED: Issue #{issue} ({task['title']}) was closed.")
        if 'hall:post-mortem' in labels:
            events.append(f"FAILED: Issue #{issue} ({task['title']}) triggered post-mortem.")
    except Exception:
        pass

for e in events:
    print(e)
PYEOF
}

if $ONCE; then
  check_once
  exit 0
fi

while true; do
  check_once 2>/dev/null || true
  sleep "$POLL_INTERVAL"
done
```

- [ ] **Step 4: Make executable**

```bash
chmod +x hooks/scripts/watcher.sh
```

- [ ] **Step 5: Add Stop hook to `hooks/hooks.json`**

```json
{
  "PreToolUse": [ ... ],
  "SessionStart": [ ... ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "if [ -f .hall-cache/watcher.pid ]; then kill $(cat .hall-cache/watcher.pid) 2>/dev/null; rm -f .hall-cache/watcher.pid; fi",
          "timeout": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 6: Run test**

```bash
bash tests/hooks/test-watcher.sh
```
Expected: 2 passed, 0 failed.

- [ ] **Step 7: Commit**

```bash
git add hooks/ tests/hooks/test-watcher.sh
git commit -m "feat: background watcher daemon — polls GitHub for in-flight task state changes"
```

---

## Task 14: Full Plugin Validation

**Files:**
- Modify: `tests/validate-plugin.sh`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Expand `tests/validate-plugin.sh` with full coverage**

Add to the existing checks block:

```bash
# Skills
for CMD in hall-doctor hall-open hall-close hall-status hall-plan hall-dispatch hall-reply hall-reconcile hall-consultations hall-prune; do
  check "skills/$CMD/SKILL.md exists" "test -f skills/$CMD/SKILL.md"
  check "skills/$CMD/SKILL.md has frontmatter" "grep -q '^---' skills/$CMD/SKILL.md"
  check "skills/$CMD/SKILL.md has name field" "grep -q '^name:' skills/$CMD/SKILL.md"
done

# Methodology
for F in old-major-local-overlay decomposition consultation-router routing-rationale; do
  check "methodology/$F.md exists" "test -f methodology/$F.md"
done
for S in tomashco frontenzo aeeeiii; do
  check "methodology/advisory-frameworks/$S.md exists" "test -f methodology/advisory-frameworks/$S.md"
done

# Templates
check "templates/CLAUDE-stack.md.tpl exists"   "test -f templates/CLAUDE-stack.md.tpl"
check "templates/plan.json.schema exists"       "test -f templates/plan.json.schema"
for S in tomashco frontenzo aeeeiii; do
  check "templates/subagents/$S.md.tpl exists" "test -f templates/subagents/$S.md.tpl"
done

# Hooks
check "hooks/hooks.json valid JSON"            "python3 -m json.tool hooks/hooks.json"
check "hooks/scripts/guard-writes.sh exists"   "test -f hooks/scripts/guard-writes.sh"
check "hooks/scripts/session-start.sh exists"  "test -f hooks/scripts/session-start.sh"
check "hooks/scripts/watcher.sh exists"        "test -f hooks/scripts/watcher.sh"
check "guard-writes.sh is executable"          "test -x hooks/scripts/guard-writes.sh"

# .gitignore
check ".hall-cache/ in .gitignore"             "grep -q '\.hall-cache' .gitignore"
```

- [ ] **Step 2: Run the full validation suite**

```bash
bash tests/validate-plugin.sh
```
Expected: all checks pass.

- [ ] **Step 3: Run all hook unit tests**

```bash
bash tests/hooks/test-guard-writes.sh && \
bash tests/hooks/test-session-start.sh && \
bash tests/hooks/test-watcher.sh
```
Expected: all pass.

- [ ] **Step 4: Smoke-test the plugin locally**

```bash
cc --plugin-dir . --debug 2>&1 | head -50
```
Expected: plugin loads without errors; all skills discovered.

- [ ] **Step 5: Update CLAUDE.md with final dev commands**

Add to the existing dev commands:

```bash
# Run full plugin validation
bash tests/validate-plugin.sh

# Run hook unit tests
bash tests/hooks/test-guard-writes.sh
bash tests/hooks/test-session-start.sh
bash tests/hooks/test-watcher.sh
```

- [ ] **Step 6: Final commit**

```bash
git add tests/validate-plugin.sh CLAUDE.md
git commit -m "feat: full plugin validation suite and updated dev commands"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered in |
|---|---|
| `/hall:open` session lifecycle | Task 8 |
| `/hall:close` session lifecycle | Task 9 |
| Persona fetch + 24h cache | Task 8 (Step 3) |
| Methodology injection | Task 4 + Task 8 (Step 4) |
| CLAUDE.md injection (with existing-file detection) | Task 8 (Step 7) |
| Subagent generation (Tomashco, Frontenzo, aeeeiii) | Task 5 + Task 8 (Step 5) |
| Guard-writes hook | Task 2 |
| Session-start hook | Task 3 |
| Three-tier consultation router (methodology file) | Task 4 (Step 3) |
| `/hall:doctor` preflight checks (all 8) | Task 7 |
| `/hall:status` plan board | Task 10 |
| `/hall:plan` dump | Task 10 |
| `/hall:dispatch` with jitter, quota, confirmation | Task 11 |
| `/hall:reconcile` GitHub sync | Task 10 |
| `/hall:reply` awaiting-input reply | Task 12 |
| `/hall:consultations` | Task 12 |
| `/hall:prune` | Task 12 |
| Background watcher daemon | Task 13 |
| plan.json schema | Task 6 |
| `.hall-cache/` directory structure | Tasks 8, 6 |
| MCP servers (sequential-thinking, fetch, github) | Task 1 |
| Gitignore auto-management | Tasks 3, 8 |

All spec requirements are covered. No gaps found.

### Known gaps in this plan (intentional)

- **Watcher → notification integration:** The watcher currently prints to stdout, which may not surface in Claude Code's UI as a real notification. This needs to be wired to Claude Code's notification mechanism (potentially a `Notification` hook or a file Claude polls). Left as a TODO in the watcher — surfacing events in the terminal is sufficient for v1.
- **Advisory specialist persona fetching:** The `/hall:open` Step 3 fetches `tomashco.md`, `frontenzo.md`, and `aeeeiii.md` from the Hall roster. The actual paths in `hall-of-automata` need to be verified — they may be in a different directory than `roster/`. Verify before implementing.
- **`--refresh` flag parsing:** The `/hall:open` SKILL.md describes `--refresh` but skills don't have argument parsing infrastructure. Old Major will need to detect the flag in the user's natural language input.
