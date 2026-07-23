# board-write — Board State Machine

Shared board resolution code. Called by hall-dispatch (In Progress transition) and hall-reconcile (Done transition). Never aborts the calling skill — log errors and continue.

## State machine

```
Todo → In Progress   (dispatch-write, triggered by hall-dispatch)
In Progress → Done   (reconcile-write, triggered by hall-reconcile)
```

## Resolution pattern

Prerequisite: `BOARD_ACTIVE` must be `True` and `~/.hall/$SLUG/board.json` must exist. Skip entirely if either condition fails.

Resolve identifiers:

```bash
PROJ_ID=$(python3 -c "import json,os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/{slug}/board.json')))['project_id'])")
FIELD_ID=$(python3 -c "import json,os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/{slug}/board-meta.json')))['fields']['Status']['id'])")
```

Find item in `board.json` where `issue_number` matches the task's `github_issue`. If absent: log `"Board item not found for issue #N"` and skip. Set `ITEM_ID` to the matched item's `id`.

`singleSelectOptionId` must be a literal in the query — GitHub Projects API rejects GraphQL variables for this field. Resolve the option value, then inline it:

```bash
gh api graphql -f query="mutation{updateProjectV2ItemFieldValue(input:{projectId:\"${PROJ_ID}\",itemId:\"${ITEM_ID}\",fieldId:\"${FIELD_ID}\",value:{singleSelectOptionId:\"${OPT}\"}}){projectV2Item{id}}}"
```

On any error: log and continue. Do not abort the calling skill.

## Procedure: dispatch-write

Called once per filed issue from hall-dispatch Step 4.

**Board parent append:** If `task["board_parent"]` is a non-null integer, fetch the parent issue body, append `- [ ] #<issue_number> [automaton] <task title>` as a new line, and write it back.

Call `mcp__github__issue_read` with `owner: <ORG>`, `repo: <REPO_NAME>`, `issueNumber: <board_parent>`. Call `mcp__github__issue_write` with `method: update`, `issue_number: <board_parent>`, `body: <updated_body>`.
`# On rate_limit error: BODY=$(gh issue view <board_parent> --repo <REPO> --json body --jq '.body'); gh issue edit <board_parent> --repo <REPO> --body "$BODY"$'\n''- [ ] #<issue_number> [automaton] <task title>'`

On any error: log `"WARN: failed to update board parent #<board_parent> — <error>"` and continue. If `board_parent` is absent or null: skip silently.

**Board status — set In Progress:**

```bash
OPT=$(python3 -c "import json,os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/{slug}/board-meta.json')))['fields']['Status']['options']['In Progress'])")
```

Execute the resolution pattern above. Log `"Board item #<N> → In Progress"` on success.

## Procedure: reconcile-write

Called from hall-reconcile for each task that newly transitioned to MERGED or DONE during the reconcile pass. Only process tasks present in `plan.json`; skip board-only items (OKR/KR).

**Board status — set Done:**

```bash
OPT=$(python3 -c "import json,os; slug='$SLUG'; print(json.load(open(os.path.expanduser(f'~/.hall/{slug}/board-meta.json')))['fields']['Status']['options']['Done'])")
```

Execute the resolution pattern above. Log `"Board item #<N> → Done"` on success.
