# board-provision — Issue Board Provisioning

Call immediately after filing a new GitHub issue. Never aborts the calling skill — log errors and continue.

No local board cache — every call resolves field/option IDs live via `gh project`. `board_project_number` in `config.json` is the only persisted anchor.

## Pre-conditions

Skip entirely if `BOARD_ACTIVE` is not `True` or `board_project_number` is absent from `config.json`.

**Caller must set before invoking:**
- `ISSUE_NUM` — newly-filed issue number
- `ITEM_TYPE` — `OKR` | `KR` | `Item` | `Bug`
- `SAGA_MILESTONE_TITLE` — human-readable saga name (e.g. `The Mended Seams`); `""` on hotfix path
- `BLOCKED_BY_LIST` — space-separated issue numbers this issue is blocked by; `""` if none

## Step 1 — Resolve identifiers

```bash
REPO=$(cat ~/.hall/.repo-slug 2>/dev/null || echo "")
ORG="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
BOARD_NUM=$(python3 -c "import json,os; print(json.load(open(os.path.expanduser('$HOME/.hall/$REPO/config.json'))).get('board_project_number',''))" 2>/dev/null || echo "")
[ -z "$BOARD_NUM" ] && { echo "No board provisioned — skipping."; exit 0; }
```

## Step 2 — Add to board

```bash
ITEM_ID=$(gh project item-add "$BOARD_NUM" --owner "$ORG" \
  --url "https://github.com/${ORG}/${REPO_NAME}/issues/${ISSUE_NUM}" \
  --format json --jq '.id' 2>&1) \
  || { echo "WARN: board item-add #${ISSUE_NUM} failed — ${ITEM_ID}"; ITEM_ID=""; }
```

If `ITEM_ID` is empty: log and skip Steps 3–5.

## Step 3 — Set Status=Backlog and ItemType

```bash
PROJ_ID=$(gh project view "$BOARD_NUM" --owner "$ORG" --format json --jq '.id')
FIELDS_JSON=$(gh project field-list "$BOARD_NUM" --owner "$ORG" --format json)
STATUS_FID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name=="Status") | .id')
BACKLOG_OPT=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name=="Status") | .options[] | select(.name=="Backlog" or .name=="Todo") | .id' | head -1)
ITYPE_FID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name=="ItemType") | .id')
ITYPE_OPT=$(echo "$FIELDS_JSON" | jq -r --arg t "$ITEM_TYPE" '.fields[] | select(.name=="ItemType") | .options[] | select(.name==$t) | .id')

gh api graphql -f query="mutation{updateProjectV2ItemFieldValue(input:{projectId:\"${PROJ_ID}\",\
itemId:\"${ITEM_ID}\",fieldId:\"${STATUS_FID}\",value:{singleSelectOptionId:\"${BACKLOG_OPT}\"}})\
{projectV2Item{id}}}" > /dev/null \
  || echo "WARN: failed to set Status on board item #${ISSUE_NUM}"
gh api graphql -f query="mutation{updateProjectV2ItemFieldValue(input:{projectId:\"${PROJ_ID}\",\
itemId:\"${ITEM_ID}\",fieldId:\"${ITYPE_FID}\",value:{singleSelectOptionId:\"${ITYPE_OPT}\"}})\
{projectV2Item{id}}}" > /dev/null \
  || echo "WARN: failed to set ItemType on board item #${ISSUE_NUM}"
echo "Board #${ISSUE_NUM} provisioned — Status: Backlog, ItemType: ${ITEM_TYPE}"
```

## Step 4 — Set milestone

Skip if `SAGA_MILESTONE_TITLE` is empty.

```bash
MILESTONE_NUM=$(gh api "repos/${ORG}/${REPO_NAME}/milestones?state=all&per_page=50" \
  --jq ".[] | select(.title == \"${SAGA_MILESTONE_TITLE}\") | .number" 2>/dev/null | head -1 || echo "")
if [ -z "$MILESTONE_NUM" ]; then
  MILESTONE_NUM=$(gh api "repos/${ORG}/${REPO_NAME}/milestones" \
    -X POST -f title="${SAGA_MILESTONE_TITLE}" --jq '.number' 2>/dev/null || echo "")
  [ -n "$MILESTONE_NUM" ] \
    && echo "Created milestone '${SAGA_MILESTONE_TITLE}' → #${MILESTONE_NUM}" \
    || echo "WARN: could not create milestone — skipping"
fi
[ -n "$MILESTONE_NUM" ] && gh api "repos/${ORG}/${REPO_NAME}/issues/${ISSUE_NUM}" \
  -X PATCH -f milestone="${MILESTONE_NUM}" > /dev/null \
  || echo "WARN: milestone set failed on #${ISSUE_NUM}"
```

## Step 5 — Wire blockedBy edges

Skip if `BLOCKED_BY_LIST` is empty. Only wire genuine prerequisites — not soft ordering or thematic grouping.

```bash
for blocker_num in $BLOCKED_BY_LIST; do
  SUBJECT_ID=$(gh issue view "${ISSUE_NUM}" --repo "${ORG}/${REPO_NAME}" \
    --json id --jq '.id' 2>/dev/null || echo "")
  OBJECT_ID=$(gh issue view "${blocker_num}" --repo "${ORG}/${REPO_NAME}" \
    --json id --jq '.id' 2>/dev/null || echo "")
  [ -n "$SUBJECT_ID" ] && [ -n "$OBJECT_ID" ] \
    && gh api graphql -f query="mutation{addIssueRelationship(input:{\
subjectIssueId:\"${SUBJECT_ID}\",objectIssueId:\"${OBJECT_ID}\",\
relationshipType:BLOCKED_BY}){relationship{type}}}" > /dev/null \
    && echo "#${ISSUE_NUM} BLOCKED_BY #${blocker_num}" \
    || echo "WARN: BLOCKED_BY edge failed #${ISSUE_NUM} ← #${blocker_num}"
done
```
