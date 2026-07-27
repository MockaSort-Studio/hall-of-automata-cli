---
name: hall-repair
description: Failure remediation. Old Major reads this after any API or git failure that recurs once. Not user-invoked.
---

# hall-repair

Failure remediation. Not user-invoked — Old Major loads this after any API or git failure that recurs once.

## Step 0 — State inventory (mandatory before any action)

Complete all items before taking any action. Do not retry the failing operation until every item is answered.

- List all branches with the relevant prefix: `git branch -r | grep <prefix>`
- Check current git status and recent log for the affected repo:
  ```bash
  git status
  git log --oneline -10
  ```
- Identify the exact error message and the operation that produced it
- State the failure class (one of: PR conflict, CI failure, branch mess, board field drift) before proceeding

Do not create branches, push files, or retry any operation until Step 0 is complete.

---

## Failure class 1 — PR conflict / dirty merge state

Decision tree:

1. **Is the branch behind master?**
   → Local `git rebase origin/master` is the correct fix. Pushing file content via API does NOT resolve a git ancestry conflict.

2. **Is there a specific file conflict?**
   → Identify which side of the merge is correct. Apply the fix manually via local git, then push.

3. **Did a prior push fail to change `mergeable_state`?**
   → Stop all API push attempts. The conflict requires local git or a manual invoker step. Escalate if local git is unavailable.

4. **Was a new branch created as a workaround?**
   → List branches first (Step 0). Do not accumulate orphan branches.

---

## Failure class 2 — CI failure

Decision tree:

1. **Read the failing log step explicitly** — do not guess from the error summary alone:
   ```bash
   gh run view <run-id> --log-failed
   ```

2. **Map the failure to one of:**
   - Missing file check (file expected but absent)
   - Wrong value (off-by-one, wrong path)
   - Stale check (references a deleted file or restructured path)
   - Deleted reference in workflow

3. **Fix the root cause.** Never bypass CI:
   - No `--no-verify`
   - No `[skip ci]`

4. **If the CI check itself is wrong** (e.g., checking for a file that was intentionally deleted): update the check, not the code.

---

## Failure class 3 — Branch mess (orphan branches)

Decision tree:

1. **Before creating any new branch**, run both of:
   ```bash
   git branch -r | grep <prefix>
   gh pr list --head <prefix>
   ```

2. **Identify which branches have open PRs vs. which are orphaned.**

3. **Delete only branches with no open PR and no commit in the last 24 hours.**

4. **Never create a branch to replace another branch that still exists.**

---

## Failure class 4 — Board field drift

There is no local plan cache to desync from — GitHub is the sole record. This class covers the GitHub Projects board's own `Status`/`ItemType` fields showing something stale (e.g. an item still `In Progress` after its PR merged).

Decision tree:

1. **Run `/hall:status` first** — it renders live from issue/PR state, independent of the board's own `Status` field. Confirm whether the *functional* state (open/closed, labels, PR) is actually correct — if so, this is cosmetic board drift only.

2. **If the board item is missing from GitHub Projects entirely:** re-add via `skills/hall-dispatch/board-provision.md`.

3. **If the board's `Status` field is stale:** read `skills/hall-dispatch/board-write.md` and run the resolution pattern directly with the correct target status (`In Progress` or `Done`) for that issue.

4. **After fixing:** run `/hall:status` again to confirm.

// Snowball 🐷 — state inventory first; every wrong action in the PR #198 audit trail had this step missing
