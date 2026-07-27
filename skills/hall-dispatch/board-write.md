# board-write — Board State Machine

Shared board resolution code. Called by `hall-dispatch` (In Progress transition) and `hall-review` (Done transition on merge). Never aborts the calling skill — log errors and continue.

No local board cache — every call resolves project, field, option, and item IDs live via `gh project`. `board_project_number` in `config.json` is the only persisted anchor.

## State machine

```
Backlog → In Progress   (dispatch-write, triggered by hall-dispatch)
In Progress → Done      (settle-write, triggered by hall-review on merge)
```

## Resolution pattern

Prerequisite: `BOARD_ACTIVE` must be `True`. Skip entirely if `board_project_number` is absent from `config.json`.

```bash
REPO=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
ORG="${REPO%%/*}"
BOARD_NUM=$(python3 -c "import json,os; print(json.load(open(os.path.expanduser('$HOME/.hall/$REPO/config.json'))).get('board_project_number',''))" 2>/dev/null || echo "")
[ -z "$BOARD_NUM" ] && { echo "No board provisioned — skipping board write."; exit 0; }

FIELD_ID=$(gh project field-list "$BOARD_NUM" --owner "$ORG" --format json --jq '.fields[] | select(.name=="Status") | .id')
OPT=$(gh project field-list "$BOARD_NUM" --owner "$ORG" --format json --jq --arg o "<TARGET_STATUS>" '.fields[] | select(.name=="Status") | .options[] | select(.name==$o) | .id')
PROJ_ID=$(gh project view "$BOARD_NUM" --owner "$ORG" --format json --jq '.id')
ITEM_ID=$(gh project item-list "$BOARD_NUM" --owner "$ORG" --format json --jq --arg n "<ISSUE_NUM>" '.items[] | select(.content.number == ($n|tonumber)) | .id')
```

If `ITEM_ID` is empty: log `"Board item not found for issue #<N>"` and skip.

`singleSelectOptionId` must be a literal in the query — GitHub Projects API rejects GraphQL variables for this field. Resolve the option value, then inline it:

```bash
gh api graphql -f query="mutation{updateProjectV2ItemFieldValue(input:{projectId:\"${PROJ_ID}\",itemId:\"${ITEM_ID}\",fieldId:\"${FIELD_ID}\",value:{singleSelectOptionId:\"${OPT}\"}}){projectV2Item{id}}}"
```

On any error: log and continue. Do not abort the calling skill.

## Procedure: dispatch-write

Called once per filed issue from `hall-dispatch` Step 4. `<TARGET_STATUS>` = `In Progress`.

**Board parent append:** If `task["board_parent"]` is a non-null integer, fetch the parent issue body, append `- [ ] #<issue_number> [automaton] <task title>` as a new line, and write it back.

```bash
BODY=$(gh issue view <board_parent> --repo "${ORG}/${REPO_NAME}" --json body --jq '.body' 2>/dev/null || echo "")
[ -n "$BODY" ] && gh issue edit <board_parent> --repo "${ORG}/${REPO_NAME}" \
  --body "$BODY"$'\n'"- [ ] #<issue_number> [automaton] <task title>" \
  || echo "WARN: failed to append to board parent #<board_parent>"
```

On any error: log `"WARN: failed to update board parent #<board_parent> — <error>"` and continue. If `board_parent` is absent or null: skip silently.

Execute the resolution pattern above with `<TARGET_STATUS>=In Progress`. Log `"Board item #<N> → In Progress"` on success.

## Procedure: settle-write

Called from `hall-review` SETTLE (0f) immediately after a PR merges. `<TARGET_STATUS>` = `Done`.

Execute the resolution pattern above with `<TARGET_STATUS>=Done`. Log `"Board item #<N> → Done"` on success.
