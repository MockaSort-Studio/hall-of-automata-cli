---
name: hall-review
description: Run the inline review loop — assess open Hall PRs and settle or escalate.
allowed-tools: [Bash, Read, mcp__github__pull_request_review_write, mcp__github__merge_pull_request]
---

# /hall:review

Discover open Hall PRs that need autonomous review from live GitHub state. Exit silently if none found. For each PR, in order:

#### 0a. Collect and filter

```bash
SLUG=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
ORG="${SLUG%%/*}"
REPO_NAME="${SLUG##*/}"

gh pr list --repo "$ORG/$REPO_NAME" --state open \
  --json number,headRefOid,headRefName \
  --jq '[.[] | select(.headRefName | startswith("hall/")) | {pr: .number, sha: .headRefOid, branch: .headRefName}]'
```

For each result, parse `<PR_NUMBER>`, `<HEAD_SHA>`, and branch components:
```bash
SPECIALIST=$(echo "<branch>" | cut -d/ -f2)
ISSUE_NUMBER=$(echo "<branch>" | sed 's/.*issue-//')
```

Skip any PR whose branch does not match `hall/<specialist>/issue-<N>` format.

**Human review guard:**
```bash
gh api repos/<ORG>/<REPO_NAME>/pulls/<PR_NUMBER>/reviews \
  --jq '[.[] | select(.state != "PENDING" and .user.type != "Bot" and (.state == "APPROVED" or .state == "CHANGES_REQUESTED"))] | length' \
  2>/dev/null || echo "0"
```
If count is `> 0`: print `"PR #<PR_NUMBER> already has a human review — skipping."` and move to next PR.

**Derive review cycle from prior Hall CHANGES_REQUESTED reviews:**
```bash
REVIEW_CYCLE=$(gh api repos/<ORG>/<REPO_NAME>/pulls/<PR_NUMBER>/reviews \
  --jq '[.[] | select(.state == "CHANGES_REQUESTED" and (.user.login | endswith("[bot]"))) ] | length' \
  2>/dev/null || echo "0")
```

If `REVIEW_CYCLE >= 1`, check whether the specialist has pushed a fix since the last review:
```bash
LAST_REVIEWED_SHA=$(gh api repos/<ORG>/<REPO_NAME>/pulls/<PR_NUMBER>/reviews \
  --jq '[.[] | select(.state == "CHANGES_REQUESTED" and (.user.login | endswith("[bot]")))] | last | .commit_id' \
  2>/dev/null || echo "")
```
If `HEAD_SHA == LAST_REVIEWED_SHA`: print `"PR #<PR_NUMBER> awaiting fix commit — skipping."` and move to next PR.

#### 0b. Render the reviewer overlay

```bash
specialist='<SPECIALIST>'
mkdir -p ~/.hall/claude-agents
gh api "repos/$ORG/hall-of-automata/contents/roster/${specialist}.md" \
  --jq '.content' | base64 -d \
  > ~/.hall/claude-agents/${specialist}-persona.md 2>/dev/null
```

```bash
python3 << 'PYEOF'
import os
plugin_root = os.environ.get('CLAUDE_PLUGIN_ROOT') or open(os.path.expanduser('~/.hall/plugin-root')).read().strip()
cache_root = os.path.expanduser('~/.hall')
specialist = '<SPECIALIST>'
persona_path = f'{cache_root}/claude-agents/{specialist}-persona.md'
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
with open(f'{cache_root}/claude-agents/{specialist}-reviewer.md', 'w') as f:
    f.write(content)
PYEOF
```

#### 0c. Run inline review

`REVIEW_CYCLE` from step 0a is the count of prior Hall CHANGES_REQUESTED reviews (0 = first review, ≥1 = ASSESS-2). Load `~/.hall/claude-agents/<specialist>-reviewer.md` via the Read tool. Run `gh pr diff <PR_NUMBER> --repo <ORG>/<REPO_NAME>` and `gh issue view <ISSUE_NUMBER> --repo <ORG>/<REPO_NAME>`. Apply the verdict taxonomy and produce the structured verdict block.

**Verdict taxonomy:**
- **LGTM** — all acceptance criteria met; no required changes
- **MINOR** — fixable in one commit (style, naming, missing edge case); specialist pushes a fix; no invoker input needed
- **MAJOR** — wrong approach, missing scope, or broken logic; requires a decision above task level; REQUEST_CHANGES with clear fix direction
- **BLOCKED** — cannot proceed without a missing dependency or unresolved architectural question; escalate to invoker

**Loop prevention:** MINOR at `REVIEW_CYCLE == 0` → REFINE (one shot). MINOR at `REVIEW_CYCLE >= 1` → escalate unconditionally. MAJOR or BLOCKED → always escalate; never loop.

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
If count is `> 0`: call `mcp__github__pull_request_review_write` with `method: "delete_pending"`, `owner: <ORG>`, `repo: <REPO_NAME>`, `pullNumber: <PR_NUMBER>`. Log `"Deleted stale pending review."`. On error: log and continue.

Submit a single GitHub PR review. The review body is the only communication to the specialist — do not post a separate issue or PR comment before or after.

LGTM: call `mcp__github__pull_request_review_write` — `owner: <ORG>`, `repo: <REPO_NAME>`, `pullNumber: <PR_NUMBER>`, `event: "APPROVE"`, `body: <verdict_text>`.  
`# On rate_limit/secondary-rate-limit error: gh pr review <PR_NUMBER> --repo <ORG>/<REPO_NAME> --approve`

MINOR / MAJOR / BLOCKED: call `mcp__github__pull_request_review_write` — same params, `event: "REQUEST_CHANGES"`, `body: <verdict_text + findings + required fix>`.  
`# On rate_limit/secondary-rate-limit error: gh pr review <PR_NUMBER> --repo <ORG>/<REPO_NAME> --request-changes --body "..."`

For MINOR at `REVIEW_CYCLE == 0`: review body must include the VERDICT line, the specific finding, exactly what to change, and "Push a fix commit to this branch." The `REQUEST_CHANGES` review IS the REFINE signal — no additional comment.

#### 0e. Route by verdict

- **LGTM** → go to 0f.
- **MINOR** and `REVIEW_CYCLE == 0` → REFINE sent via REQUEST_CHANGES. Move to next PR.
- **MINOR** and `REVIEW_CYCLE >= 1` (ASSESS-2) → go to 0f with escalation.
- **MAJOR** or **BLOCKED** → go to 0f with escalation.

#### 0f. SETTLE

Read `automation_level` from `~/.hall/$ORG/$REPO_NAME/config.json`.

| Verdict | Level | Action |
|---------|-------|--------|
| LGTM | 2 | Call `mcp__github__merge_pull_request` (`owner`, `repo`, `pullNumber: <PR>`, `merge_method: "squash"`); `# On rate_limit/secondary-rate-limit error: gh pr merge --squash --repo <ORG>/<REPO_NAME> <PR_NUMBER>`. On success: read `skills/hall-dispatch/board-write.md` and execute the **settle-write** procedure for `<ISSUE_NUMBER>`. |
| LGTM | 0 or 1 | Print: `PR #<N> is LGTM — please review and merge.` |
| MINOR (ASSESS-2), MAJOR, BLOCKED | any | Print verdict summary and findings. |

#### 0g. Summary

After processing all PRs, print:

```
Review dispatch complete: N reviewed, M settled (merged/escalated), K sent to REFINE.
```
