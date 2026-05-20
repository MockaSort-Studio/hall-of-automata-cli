#!/usr/bin/env bash
# Field creation for /hall:init-board.
# Required env: PROJECT_ID

create_fields() {
  local pid="${PROJECT_ID:?PROJECT_ID required}"

  # -- helpers ----------------------------------------------------------------

  local existing
  existing=$(gh api graphql \
    -f query='query($p:ID!){node(id:$p){...on ProjectV2{fields(first:50){nodes{...on ProjectV2Field{name}...on ProjectV2SingleSelectField{name}}}}}}' \
    -F p="$pid" \
    --jq '[.data.node.fields.nodes[] | select(. != null) | .name]' 2>/dev/null || echo '[]')

  _exists() { echo "$existing" | jq -e --arg n "$1" 'contains([$n])' > /dev/null 2>&1; }

  _text() {
    _exists "$1" && { echo "  skip: $1 (exists)"; return; }
    local q='mutation($pid:ID!,$n:String!){createProjectV2Field(input:{projectId:$pid,name:$n,dataType:TEXT}){projectV2Field{...on ProjectV2Field{id}}}}'
    jq -n --arg q "$q" --arg pid "$pid" --arg n "$1" \
      '{"query":$q,"variables":{"pid":$pid,"n":$n}}' \
    | gh api graphql --input - > /dev/null
    echo "  created: $1 (text)"
  }

  _select() {
    local name="$1" opts="$2"
    _exists "$name" && { echo "  skip: $name (exists)"; return; }
    local q='mutation($pid:ID!,$n:String!,$opts:[ProjectV2SingleSelectFieldOptionInput!]){createProjectV2Field(input:{projectId:$pid,name:$n,dataType:SINGLE_SELECT,singleSelectOptions:$opts}){projectV2Field{...on ProjectV2SingleSelectField{id}}}}'
    jq -n --arg q "$q" --arg pid "$pid" --arg n "$name" --argjson opts "$opts" \
      '{"query":$q,"variables":{"pid":$pid,"n":$n,"opts":$opts}}' \
    | gh api graphql --input - > /dev/null
    echo "  created: $name (single-select)"
  }

  _update_select_options() {
    local name="$1" opts="$2"
    local fid
    fid=$(gh api graphql \
      -f query='query($p:ID!){node(id:$p){...on ProjectV2{fields(first:50){nodes{...on ProjectV2SingleSelectField{id name}}}}}}' \
      -F p="$pid" 2>/dev/null \
      | jq -r --arg n "$name" '.data.node.fields.nodes[] | select(.name == $n) | .id' 2>/dev/null \
      || echo "")
    if [ -z "$fid" ]; then
      echo "  skip: $name (field not found)"
      return
    fi
    local q='mutation($pid:ID!,$fid:ID!,$opts:[ProjectV2SingleSelectFieldOptionInput!]!){updateProjectV2Field(input:{projectId:$pid,fieldId:$fid,singleSelectOptions:$opts}){projectV2Field{id}}}'
    jq -n --arg q "$q" --arg pid "$pid" --arg fid "$fid" --argjson opts "$opts" \
      '{"query":$q,"variables":{"pid":$pid,"fid":$fid,"opts":$opts}}' \
    | gh api graphql --input - > /dev/null
    echo "  updated: $name (options replaced)"
  }

  # -- field creation ---------------------------------------------------------

  echo "Creating custom fields..."
  _select "Type"     '[{"name":"OKR"},{"name":"KR"},{"name":"Item"}]'
  _text   "Owner"
  _select "Priority" '[{"name":"P0"},{"name":"P1"},{"name":"P2"},{"name":"P3"}]'
  _text   "Reference"

  # -- Status options: only on fresh boards to avoid clobbering live values --

  local board_was_created
  board_was_created=$(python3 -c \
    "import json; print(json.load(open('.hall-cache/session/.board-init-state.json')).get('board_was_created', False))" \
    2>/dev/null || echo "False")
  if [ "$board_was_created" = "True" ]; then
    echo "Updating Status options (fresh board)..."
    _update_select_options "Status" '[{"name":"Backlog"},{"name":"In Design"},{"name":"In Progress"},{"name":"Done"}]'
  fi

  echo "Fields done."
}
