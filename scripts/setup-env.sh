#!/usr/bin/env bash
# One-command, one-password setup for Gondolin Crew workers: installs Nix if
# missing, adds the Armory binary cache, restarts the Nix daemon, and verifies.
# Idempotent. Crew itself never runs this; it only reports it when Nix or the
# cache is missing and falls back to host-only workers.
#   scripts/setup-env.sh [--dry-run] [--yes]
set -euo pipefail

# One source of truth for the cache identity, shared with the Crew runtime.
CACHE_FILE="$(cd "$(dirname "$0")/.." && pwd)/.pi/extensions/hall-crew/env-runtime/armory-cache.json"
CACHE_URL=$(node -p "require('$CACHE_FILE').substituter")
CACHE_KEY=$(node -p "require('$CACHE_FILE').publicKey")
CONF="${NIX_CUSTOM_CONF:-/etc/nix/nix.custom.conf}"
NIX_DEFAULT="/nix/var/nix/profiles/default/bin/nix"
INSTALLER="https://install.determinate.systems/nix"

dry=0; yes=0
for arg in "$@"; do
  case "$arg" in --dry-run) dry=1 ;; --yes) yes=1 ;; *) echo "unknown option: $arg" >&2; exit 2 ;; esac
done

run() { if [ "$dry" = 1 ]; then echo "[dry-run] $*"; else "$@"; fi; }

find_nix() { command -v nix 2>/dev/null || { [ -x "$NIX_DEFAULT" ] && echo "$NIX_DEFAULT"; } || true; }

plan=()
[ -n "$(find_nix)" ] || plan+=("install Nix (Determinate installer)")
grep -qs "$CACHE_URL" "$CONF" || plan+=("add the Armory cache to $CONF")
[ "${#plan[@]}" -gt 0 ] || { echo "Nix and the Armory cache are already configured."; exit 0; }

echo "This will:"; printf '  - %s\n' "${plan[@]}"; echo "and restart the Nix daemon. It needs administrator rights (one password prompt)."
if [ "$yes" = 0 ] && [ "$dry" = 0 ]; then
  read -r -p "Continue? [y/N] " answer; [ "$answer" = "y" ] || { echo "Cancelled."; exit 1; }
fi
[ "$dry" = 1 ] || sudo -v

if [ -z "$(find_nix)" ]; then
  run bash -c "curl --proto '=https' --tlsv1.2 -sSf -L $INSTALLER | sh -s -- install --no-confirm"
fi

if ! grep -qs "$CACHE_URL" "$CONF"; then
  run sudo mkdir -p "$(dirname "$CONF")"
  entry="extra-substituters = $CACHE_URL
extra-trusted-public-keys = $CACHE_KEY"
  if [ "$dry" = 1 ]; then echo "[dry-run] append to $CONF:"; echo "$entry"; else echo "$entry" | sudo tee -a "$CONF" >/dev/null; fi
fi

case "$(uname -s)" in
  Darwin) run sudo launchctl kickstart -k system/systems.determinate.nix-daemon ;;
  *) run sudo systemctl restart nix-daemon ;;
esac

[ "$dry" = 1 ] && exit 0
"$(find_nix)" config show substituters | grep -q "$CACHE_URL" && echo "Done: Nix and the Armory cache are ready." \
  || { echo "Cache not active yet; start a new shell or re-run." >&2; exit 1; }
