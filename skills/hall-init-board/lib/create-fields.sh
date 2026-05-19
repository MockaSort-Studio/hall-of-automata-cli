#!/usr/bin/env bash
# Field creation for /hall:init-board.
# Required env: PROJECT_ID

create_fields() {
  local pid="${PROJECT_ID:?PROJECT_ID required}"

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

  echo "Creating custom fields..."
  _text "Invoker"
  _select "Priority" '[{"name":"critical"},{"name":"high"},{"name":"medium"},{"name":"low"}]'
  _text "Design Doc"
  _select "Risk" '[{"name":"none"},{"name":"low"},{"name":"medium"},{"name":"high"}]'
  _text "Epic"
  _text "Specialist"
  echo "Fields done."
}
