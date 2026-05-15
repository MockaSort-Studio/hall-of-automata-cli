#!/usr/bin/env bash
# Portal animation — hall:open Step 11

RESET=$'\033[0m'
MAG=$'\033[35m'
BMAG=$'\033[95m'
GOLD=$'\033[33m'
WHITE=$'\033[97m'
BOLD=$'\033[1m'

COLS=$(tput cols 2>/dev/null || echo 0)
FINAL="Old Major has entered the Hall."

if [ "${HALL_NO_BANNER:-0}" = "1" ] || [ "$COLS" -lt 60 ]; then
  printf '%s\n' "$FINAL"
  exit 0
fi

clr() { printf '\033[%dA\033[J' "$1"; }

portal() {
  printf '%s              .::::::::::.  %s\n' "$BMAG" "$RESET"
  printf '%s           ::::::::::::::::::::  %s\n' "$MAG" "$RESET"
  printf '%s          ::::::          ::::::  %s\n' "$BMAG" "$RESET"
  printf '%s          :::::    ~~~~    :::::  %s\n' "$MAG" "$RESET"
  printf '%s          ::::::          ::::::  %s\n' "$BMAG" "$RESET"
  printf '%s           ::::::::::::::::::::  %s\n' "$MAG" "$RESET"
  printf "%s              '::::::::::' %s\n" "$BMAG" "$RESET"
}

# Frame 1: hairline crack (blank + crack + blank = 3 lines)
printf '\n%s                    |%s\n\n' "$MAG" "$RESET"
sleep 0.5
clr 3

# Frame 2: crack widens (blank + 2 lines + blank = 4 lines)
printf '\n%s                  ( | )%s\n' "$MAG" "$RESET"
printf "%s                 '|||||'%s\n\n" "$BMAG" "$RESET"
sleep 0.5
clr 4

# Frame 3: full oval portal (blank + 7 + blank = 9 lines)
printf '\n'; portal; printf '\n'
sleep 0.8
clr 9

# Frame 4: silhouette steps through (blank + 7 + blank = 9 lines)
printf '\n'
printf '%s              .::::::::::.  %s\n' "$BMAG" "$RESET"
printf '%s           ::::::::::::::::::::  %s\n' "$MAG" "$RESET"
printf '%s          ::::::   .-.    ::::::  %s\n' "$BMAG" "$RESET"
printf '%s          :::::   (o o)   :::::  %s\n' "$MAG" "$RESET"
printf '%s          ::::::  | O |   ::::::  %s\n' "$BMAG" "$RESET"
printf '%s           :::::  /|---|\\  :::::  %s\n' "$MAG" "$RESET"
printf "%s              '::::::::::' %s\n" "$BMAG" "$RESET"
printf '\n'
sleep 0.7
clr 9

# Frame 5: portal clears, figure steps out (permanent)
printf '\n'; portal; printf '\n'
printf '%s    .-.\n%s'                                            "$GOLD" "$RESET"
printf '%s   (o o)   %s<- Old Major%s\n'                        "$GOLD" "$WHITE" "$RESET"
printf '%s   | O |\n  /|---|\\\n / |   | \\\n%s\n'              "$GOLD" "$RESET"
printf '\n'

# Flavor text materialises line by line
sleep 0.3
printf '%s%sA rift tears open in the fabric of reason.%s\n'      "$BOLD" "$WHITE" "$RESET"
sleep 0.4
printf '%sThrough crackling violet light, a figure emerges ---%s\n' "$WHITE" "$RESET"
sleep 0.4
printf '%sbroad-shouldered, unhurried, eyes like embers.%s\n'     "$WHITE" "$RESET"
sleep 0.5
printf '\n%s%s%s\n\n' "$GOLD$BOLD" "$FINAL" "$RESET"
