#!/usr/bin/env bash
# Hall status line — reads session JSON from stdin, outputs one line

RESET=$'\033[0m'
GBOLD=$'\033[1;33m'
WBOLD=$'\033[1;37m'
GREEN=$'\033[32m'
AMBER=$'\033[33m'
RED=$'\033[31m'
CYAN=$'\033[36m'
DIM=$'\033[2m'
SEP="${DIM}│${RESET}"

STDIN=$(cat)

# Context window percentage from session JSON
CTX_PCT=""
if command -v jq &>/dev/null; then
  CTX_PCT=$(printf '%s' "$STDIN" | jq -r '.context_window.usage_percentage // empty' 2>/dev/null)
elif command -v python3 &>/dev/null; then
  CTX_PCT=$(printf '%s' "$STDIN" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('context_window',{}).get('usage_percentage',''))" \
    2>/dev/null)
fi

# Watcher status
WATCH="${RED}OFF${RESET}"
WPID=$(cat .hall-cache/watcher.pid 2>/dev/null)
if [ -n "$WPID" ] && kill -0 "$WPID" 2>/dev/null; then WATCH="${GREEN}ON${RESET}"; fi

# Automation level
AUTO="${DIM}?${RESET}"
if [ -f .hall-cache/session/config.json ] && command -v python3 &>/dev/null; then
  LVL=$(python3 -c \
    "import json; d=json.load(open('.hall-cache/session/config.json')); print(d.get('automation_level',''))" \
    2>/dev/null)
  case "$LVL" in
    2) AUTO="${CYAN}AUTO${RESET}" ;;
    1) AUTO="${AMBER}REVIEW${RESET}" ;;
    0) AUTO="${DIM}MANUAL${RESET}" ;;
  esac
fi

# Plan status — plan.md uses table rows: | ID | ... | DONE/IN_PROGRESS | ... |
PLAN="${DIM}no active plan${RESET}"
LIVE_SEG=""
for plan_f in .hall-cache/plans/*/plan.md; do
  [ -f "$plan_f" ] || break
  grep -q "Status: DONE" "$plan_f" 2>/dev/null && continue
  PNAME=$(basename "$(dirname "$plan_f")")
  DONE=$(grep -cE "\| DONE( \(inline\))? +\|" "$plan_f" 2>/dev/null || echo 0)
  TOTAL=$(grep -cE "\| (DONE|IN_PROGRESS|BACKLOG|REVIEWING|ESCALATED)" "$plan_f" 2>/dev/null || echo 0)
  PCT=0; [ "$TOTAL" -gt 0 ] && PCT=$(( DONE * 100 / TOTAL ))
  if   [ "$PCT" -ge 85 ]; then BC="$RED"
  elif [ "$PCT" -ge 50 ]; then BC="$AMBER"
  else BC="$GREEN"; fi
  PLAN="${WBOLD}${PNAME}${RESET} ${BC}[${DONE}/${TOTAL}]${RESET}"
  LIVE=$(grep -cE "\| IN_PROGRESS +\|" "$plan_f" 2>/dev/null || echo 0)
  if   [ "$LIVE" -gt 3 ]; then LIVE_SEG=" ${SEP} ${RED}⚡ ${LIVE} live${RESET}"
  elif [ "$LIVE" -gt 0 ]; then LIVE_SEG=" ${SEP} ${AMBER}⚡ ${LIVE} live${RESET}"; fi
  break
done

# Context bar
CTX_SEG=""
if [ -n "$CTX_PCT" ] && [ "$CTX_PCT" != "null" ] && [ "$CTX_PCT" != "" ]; then
  P=${CTX_PCT%%.*}
  F=$(( P * 8 / 100 )); BAR=""; i=0
  while [ $i -lt $F ]; do BAR="${BAR}█"; i=$(( i + 1 )); done
  while [ $i -lt 8 ];  do BAR="${BAR}░"; i=$(( i + 1 )); done
  if   [ "$P" -ge 85 ]; then BC2="$RED"
  elif [ "$P" -ge 60 ]; then BC2="$AMBER"
  else BC2="$GREEN"; fi
  CTX_SEG=" ${SEP} ${BC2}${BAR} ${P}%${RESET}"
fi

printf '%s⚔ OLD MAJOR%s %s %s%s %s⚖ %s %s👁 %s%s' \
  "$GBOLD" "$RESET" "$SEP" \
  "$PLAN" "$LIVE_SEG" \
  "$SEP" "$AUTO" \
  "$SEP" "$WATCH" \
  "$CTX_SEG"
