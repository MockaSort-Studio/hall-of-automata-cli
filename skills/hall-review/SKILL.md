---
name: hall-review
description: Run the inline review loop — assess open PRs for needs_review tasks and settle or escalate.
allowed-tools: [Bash, Read, mcp__github__list_pull_requests, mcp__github__pull_request_review_write, mcp__github__merge_pull_request]
---

# /hall:review

Collect tasks with `needs_review: true` from the active plan's `plan.json`. If none, exit silently. For each such task, in order:

#### 0a. Locate the PR

Call `mcp__github__list_pull_requests` with `query: "repo:<ORG/REPO> closes #<ISSUE_NUMBER> is:open"`. Take `number` and `head.sha` from the first result.  
`# On rate_limit/secondary-rate-limit error: gh pr list --repo <REPO> --search "closes #<ISSUE_NUMBER> is:open" --json number,headSha --jq '.[0]'`

Empty result: print `Task <id> has needs_review but no open PR — skipping.` and move to next task.

**Check for existing human review:**

```bash
gh api repos/<ORG>/<REPO_NAME>/pulls/<PR_NUMBER>/reviews \
  --jq '[.[] | select(.state != "PENDING" and .user.type != "Bot" and (.state == "APPROVED" or .state == "CHANGES_REQUESTED"))] | length' \
  2>/dev/null || echo "0"
```

If the count is `> 0`: print `"PR #<PR_NUMBER> already has a human review — skipping autonomous review."` Clear `needs_review` on the task in `plan.json` and move to the next task. Do not proceed to 0b.

#### 0b. Render the reviewer overlay

```bash
specialist='<SPECIALIST>'  # substitute task['specialist']
mkdir -p ~/.hall/session/claude-agents
gh api "repos/MockaSort-Studio/hall-of-automata/contents/roster/${specialist}.md" \
  --jq '.content' | base64 -d \
  > ~/.hall/session/claude-agents/${specialist}-persona.md 2>/dev/null
```

```bash
python3 << 'PYEOF'
import os
plugin_root = os.environ.get('CLAUDE_PLUGIN_ROOT') or open(os.path.expanduser('~/.hall/session/.plugin-root')).read().strip()
cache_root = os.path.expanduser('~/.hall')
specialist = '<SPECIALIST>'  # substitute task['specialist']
persona_path = f'{cache_root}/session/claude-agents/{specialist}-persona.md'
with open(f'{plugin_root}/templates/reviewer-overlay.md.tpl') as f:
    template = f.read()
with open(persona_path) as f:
    lines = [l.rstrip() for l in f if l.strip()]
description = next((l.lstrip('# ') for l in lines if l.startswith('#')), specialist)
content = (template
    .replace('{{SPECIALIST_NAME}}', specialist)
    .replace('{{SPECIALIST_DESCRIPTION}}', description)
    .replace('{{PERSONA_PATH}}', persona_path)
    .replace('{{CACHE_ROOT}}', cache_root))
with open(f'{cache_root}/session/claude-agents/{specialist}-reviewer.md', 'w') as f:
    f.write(content)
PYEOF
```

#### 0c. Run inline review

Treat `review_cycle` as 1 if absent. Load `~/.hall/session/claude-agents/<specialist>-reviewer.md` via the Read tool. Run `gh pr diff <PR_NUMBER> --repo <REPO>` and `gh issue view <ISSUE_NUMBER> --repo <REPO>`. Apply the verdict taxonomy below and produce the structured verdict block.

**Verdict taxonomy:**
- **LGTM** — all acceptance criteria met; no required changes
- **MINOR** — fixable in one commit (style, naming, missing edge case); specialist pushes a fix; no invoker input needed
- **MAJOR** — wrong approach, missing scope, or broken logic; requires a decision above task level; REQUEST_CHANGES with clear fix direction
- **BLOCKED** — cannot proceed without a missing dependency or unresolved architectural question; escalate to invoker

**Loop prevention:** MINOR at cycle 1 → REFINE (one shot). MINOR at cycle 2 → escalate unconditionally. MAJOR or BLOCKED → always escalate; never loop.

**Verdict format** (review body):
```
VERDICT: <LGTM|MINOR|MAJOR|BLOCKED>
---
<1-3 bullet findings if not LGTM>
<Required fix: specific enough that the specialist can act without asking>
```

#### 0d. Submit GitHub review

**Pre-check — clear stale pending review from a prior partial run:**

```bash
gh api repos/<ORG>/<REPO_NAME>/pulls/<PR_NUMBER>/reviews \
  --jq '[.[] | select(.state == "PENDING")] | length' 2>/dev/null || echo "0"
```

If the count is `> 0`: call `mcp__github__pull_request_review_write` with `method: "delete_pending"`, `owner: <ORG>`, `repo: <REPO_NAME>`, `pullNumber: <PR_NUMBER>`. Log `"Deleted stale pending review."`. On error: log and continue.

Submit a single GitHub PR review. The review body is the only communication to the specialist — do not post a separate issue or PR comment before or after.

LGTM: Call `mcp__github__pull_request_review_write` with `owner: <ORG>`, `repo: <REPO_NAME>`, `pullNumber: <PR_NUMBER>`, `event: "APPROVE"`, `body: <verdict_text>`.  
`# On rate_limit/secondary-rate-limit error: gh pr review <PR_NUMBER> --repo <REPO> --approve`

MINOR / MAJOR / BLOCKED: Call `mcp__github__pull_request_review_write` with same params, `event: "REQUEST_CHANGES"`, `body: <verdict_text + findings + required fix>`.  
`# On rate_limit/secondary-rate-limit error: gh pr review <PR_NUMBER> --repo <REPO> --request-changes --body "..."`

For MINOR at `review_cycle == 1`, the review body must include: the VERDICT line, the specific finding, exactly what to change, and "Push a fix commit to this branch."

The GitHub review state drives the relay: `REQUEST_CHANGES` triggers the Hall to re-invoke the specialist for the REFINE cycle. Never skip this step.

After submitting the review, fetch and store the reviewed SHA:

```bash
HEAD_SHA=$(gh pr view <PR_NUMBER> --repo <REPO> --json headRefOid --jq '.headRefOid')
```

Write `last_reviewed_sha: <HEAD_SHA>` to the task entry in `plan.json`.

#### 0e. Route by verdict

Read the `VERDICT:` line from the returned block:

- **LGTM** → go to 0f.
- **MINOR** and `review_cycle == 1` → REFINE: in `plan.json` set `review_cycle: 2`, `needs_review: false`, status `REVIEWING`. Write `plan.json`. Move to next task. (The fix direction was already included in the REQUEST_CHANGES review body — no additional comment.)
- **MINOR** and `review_cycle == 2` (ASSESS-2) → go to 0f.
- **MAJOR** or **BLOCKED** → go to 0f with escalation.

#### 0f. SETTLE

Read `automation_level` from `~/.hall/<org>/<slug>/config.json` (org/slug from `~/.hall/session/.repo-slug`).

| Verdict | Level | Action |
|---------|-------|--------|
| LGTM | 2 | Call `mcp__github__merge_pull_request` (`owner`, `repo`, `pullNumber: <PR>`, `merge_method: "merge"`); `# On rate_limit/secondary-rate-limit error: gh pr merge --merge --repo <REPO> <PR_NUMBER>` — set status `MERGED`, clear `needs_review` |
| LGTM | 0 or 1 | Print: `PR #<N> is LGTM — please review and merge. Task remains REVIEWING.` |
| MINOR (ASSESS-2), MAJOR, BLOCKED | any | Print verdict summary and findings. Set status `ESCALATED`. Clear `needs_review`. |

Write `plan.json`.

#### 0g. Summary

After processing all `needs_review` tasks, print:

```
Review dispatch complete: N reviewed, M settled (DONE/ESCALATED), K pending REFINE.
```
