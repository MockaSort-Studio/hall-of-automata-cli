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

# gh's --jq flag takes exactly one filter argument — it cannot carry jq's own
# --arg mechanism. Resolve each query to a temp file, then filter with the
# local jq binary. Files, not `echo "$VAR" | jq`: under zsh, `echo` expands
# backslash escapes by default, corrupting any \n embedded in an issue body.
FIELDS_TMP=$(mktemp) && ITEMS_TMP=$(mktemp)
gh project field-list "$BOARD_NUM" --owner "$ORG" --format json > "$FIELDS_TMP"
gh project item-list "$BOARD_NUM" --owner "$ORG" --format json --limit 200 > "$ITEMS_TMP"

FIELD_ID=$(jq -r '.fields[] | select(.name=="Status") | .id' "$FIELDS_TMP")
OPT=$(jq -r --arg o "<TARGET_STATUS>" '.fields[] | select(.name=="Status") | .options[] | select(.name==$o) | .id' "$FIELDS_TMP")
PROJ_ID=$(gh project view "$BOARD_NUM" --owner "$ORG" --format json --jq '.id')
ITEM_ID=$(jq -r --arg n "<ISSUE_NUM>" '.items[] | select(.content.number == ($n|tonumber)) | .id' "$ITEMS_TMP")
rm -f "$FIELDS_TMP" "$ITEMS_TMP"
```

`--limit 200` on `item-list`: the board carries 90+ items and `gh`'s default limit is 30 — without an explicit limit, resolution silently fails for any item outside the first page.

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

After a successful Item settle, run **cascade-settle** below for `<ISSUE_NUM>`.

## Procedure: cascade-settle

Closing an Item's own board status does not touch its parent KR or grandparent OKR — nothing else does either, so without this step a KR/OKR can sit at `Backlog`/open indefinitely after every child under it is actually done. Don't rely on GitHub Projects' own built-in automation for this (unverified whether it's configured, and not something this methodology should depend on implicitly) — make it explicit.

Walk up the parent chain one level at a time, stopping as soon as a level isn't fully complete:

```bash
CURRENT="<ISSUE_NUM>"
while true; do
  PARENT_URL=$(gh api "repos/${ORG}/${REPO_NAME}/issues/${CURRENT}" --jq '.parent_issue_url // empty' 2>/dev/null)
  [ -z "$PARENT_URL" ] && break
  PARENT_NUM="${PARENT_URL##*/}"

  PCT=$(gh api "repos/${ORG}/${REPO_NAME}/issues/${PARENT_NUM}" --jq '.sub_issues_summary.percent_completed // 0' 2>/dev/null)
  [ "$PCT" != "100" ] && break

  # Board Status → Done (resolution pattern above, ISSUE_NUM=PARENT_NUM, TARGET_STATUS=Done)

  STATE=$(gh api "repos/${ORG}/${REPO_NAME}/issues/${PARENT_NUM}" --jq '.state' 2>/dev/null)
  if [ "$STATE" = "open" ]; then
    gh api "repos/${ORG}/${REPO_NAME}/issues/${PARENT_NUM}" -X PATCH \
      -f state="closed" -f state_reason="completed" > /dev/null \
      && echo "#${PARENT_NUM} closed — all sub-issues complete" \
      || echo "WARN: failed to close #${PARENT_NUM}"
  fi

  CURRENT="$PARENT_NUM"
done
```

On any error at any step: log and continue — never abort the calling skill over a cascade failure.
