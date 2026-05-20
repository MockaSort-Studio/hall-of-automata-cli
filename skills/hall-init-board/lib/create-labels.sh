#!/usr/bin/env bash
# Label creation for /hall:init-board.
# Required env: REPO (owner/repo format)

create_labels() {
  local repo="${REPO:?REPO required}"

  local existing
  existing=$(gh label list --repo "$repo" --json name --jq '[.[].name]' --limit 200 2>/dev/null || echo '[]')

  _label() {
    local name="$1" color="$2" desc="$3"
    echo "$existing" | jq -e --arg n "$name" 'contains([$n])' > /dev/null 2>&1 \
      && { echo "  skip: $name (exists)"; return; }
    gh label create "$name" --color "$color" --description "$desc" --repo "$repo"
    echo "  created: $name"
  }

  echo "Creating labels..."
  _label "type/feature"       "0075ca" "New user-facing capability"
  _label "type/bug"           "d73a4a" "Incorrect behaviour in existing functionality"
  _label "type/chore"         "e4e669" "Maintenance, non-functional changes"
  _label "type/okr"           "6f42c1" "Product objective — top-level OKR"
  _label "type/kr"            "0052cc" "Key Result within an OKR"
  _label "type/item"          "0075ca" "Unit of work within a Key Result"
  _label "priority/critical"  "b60205" "Blocks the next release or a dependent specialist"
  _label "priority/high"      "e11d48" "Should land in the current planning cycle"
  _label "priority/medium"    "f9d0c4" "Default; no urgency constraint"
  _label "priority/low"       "fef2c0" "Nice to have; deferred if quota is scarce"
  _label "hall/board-sync"    "0e8a16" "Issue has a corresponding Projects v2 item"
  _label "hall/cross-invoker" "006b75" "Item referenced or commented on by a foreign invoker"
  echo "Labels done."
}
