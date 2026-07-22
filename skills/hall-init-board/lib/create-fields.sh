#!/usr/bin/env bash
# Field creation for /hall:init-board.
# Required env: PROJECT_ID

create_fields() {
  local pid="${PROJECT_ID:?PROJECT_ID required}"
  local GH; GH=$(command -v gh)
  local JQ; JQ=$(command -v jq)
  local PYTHON3; PYTHON3=$(command -v python3)

  # -- helpers ----------------------------------------------------------------

  local existing
  existing=$("$GH" api graphql \
    -f query='query($p:ID!){node(id:$p){...on ProjectV2{fields(first:50){nodes{...on ProjectV2Field{name}...on ProjectV2SingleSelectField{name}}}}}}' \
    -F p="$pid" \
    --jq '[.data.node.fields.nodes[] | select(. != null) | .name]' 2>/dev/null || echo '[]')

  _exists() { echo "$existing" | "$JQ" -e --arg n "$1" 'contains([$n])' > /dev/null 2>&1; }

  _text() {
    _exists "$1" && { echo "  skip: $1 (exists)"; return; }
    local q='mutation($pid:ID!,$n:String!){createProjectV2Field(input:{projectId:$pid,name:$n,dataType:TEXT}){projectV2Field{...on ProjectV2Field{id}}}}'
    "$JQ" -n --arg q "$q" --arg pid "$pid" --arg n "$1" \
      '{"query":$q,"variables":{"pid":$pid,"n":$n}}' \
    | "$GH" api graphql --input - > /dev/null
    echo "  created: $1 (text)"
  }

  # singleSelectOptions are inlined as GraphQL literals — enum color values
  # cannot be coerced from JSON strings when passed as GraphQL variables.
  _select() {
    local name="$1" opts_gql="$2"
    _exists "$name" && { echo "  skip: $name (exists)"; return; }
    local q="mutation(\$pid:ID!,\$n:String!){createProjectV2Field(input:{projectId:\$pid,name:\$n,dataType:SINGLE_SELECT,singleSelectOptions:${opts_gql}}){projectV2Field{...on ProjectV2SingleSelectField{id}}}}"
    "$GH" api graphql -f query="$q" -F pid="$pid" -F n="$name" > /dev/null
    echo "  created: $name (single-select)"
  }

  _update_select_options() {
    local name="$1" opts_gql="$2"
    local fid
    fid=$("$GH" api graphql \
      -f query='query($p:ID!){node(id:$p){...on ProjectV2{fields(first:50){nodes{...on ProjectV2SingleSelectField{id name}}}}}}' \
      -F p="$pid" 2>/dev/null \
      | "$JQ" -r --arg n "$name" '.data.node.fields.nodes[] | select(.name == $n) | .id' 2>/dev/null \
      || echo "")
    if [ -z "$fid" ]; then
      echo "  skip: $name (field not found)"
      return
    fi
    local q="mutation(\$fid:ID!){updateProjectV2Field(input:{fieldId:\$fid,singleSelectOptions:${opts_gql}}){projectV2Field{...on ProjectV2SingleSelectField{id}}}}"
    "$GH" api graphql -f query="$q" -F fid="$fid" > /dev/null
    echo "  updated: $name (options replaced)"
  }

  # -- field creation ---------------------------------------------------------

  echo "Creating custom fields..."
  _select "ItemType" '[{name:"OKR",color:BLUE,description:""},{name:"KR",color:PURPLE,description:""},{name:"Item",color:GRAY,description:""},{name:"Bug",color:RED,description:""}]'

  # Add Bug to existing boards where ItemType was created before Bug was introduced.
  # updateProjectV2Field replaces option IDs — safe only when no board items have ItemType set,
  # which is the case for boards where provisioning was never done (pre-#278).
  local has_bug
  has_bug=$("$GH" api graphql \
    -f query='query($p:ID!){node(id:$p){...on ProjectV2{fields(first:50){nodes{...on ProjectV2SingleSelectField{name options{name}}}}}}}' \
    -F p="$pid" 2>/dev/null \
    | "$JQ" -r '.data.node.fields.nodes[] | select(.name=="ItemType") | .options[] | select(.name=="Bug") | .name' \
    2>/dev/null || echo "")
  if [ -z "$has_bug" ]; then
    echo "  adding Bug to ItemType (existing board)..."
    _update_select_options "ItemType" '[{name:"OKR",color:BLUE,description:""},{name:"KR",color:PURPLE,description:""},{name:"Item",color:GRAY,description:""},{name:"Bug",color:RED,description:""}]'
  fi

  _text   "Owner"
  _select "Priority" '[{name:"P0",color:RED,description:""},{name:"P1",color:ORANGE,description:""},{name:"P2",color:YELLOW,description:""},{name:"P3",color:GRAY,description:""}]'
  _text   "Reference"

  # -- Status options: only on fresh boards to avoid clobbering live values --

  local board_was_created
  board_was_created=$("$PYTHON3" -c \
    "import json, os; print(json.load(open(os.path.expanduser('~/.hall/session/.board-init-state.json'))).get('board_was_created', False))" \
    2>/dev/null || echo "False")
  if [ "$board_was_created" = "True" ]; then
    echo "Updating Status options (fresh board)..."
    _update_select_options "Status" '[{name:"Backlog",color:GRAY,description:""},{name:"In Design",color:BLUE,description:""},{name:"In Progress",color:ORANGE,description:""},{name:"Done",color:GREEN,description:""}]'
  fi

  echo "Fields done."
}
