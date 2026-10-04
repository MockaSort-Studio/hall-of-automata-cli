#!/usr/bin/env bash
# Stores the GitHub token Crew workers use, as HALL_GITHUB_TOKEN, in a private file
# that your shell profile sources. Hall never reads a `gh` login or keyring on its
# own; you hand over a token deliberately, here.
#   scripts/setup-github-token.sh              prompt for a token (input is hidden)
#   scripts/setup-github-token.sh --from-gh    use the token of your current `gh` login
#   options: --dry-run (change nothing), --no-verify (skip the GitHub check)
set -euo pipefail

ENV_FILE="${HALL_ENV_FILE:-$HOME/.config/hall/env}"
case "$(basename "${SHELL:-zsh}")" in bash) default_profile="$HOME/.bashrc" ;; *) default_profile="$HOME/.zshrc" ;; esac
PROFILE="${HALL_SHELL_PROFILE:-$default_profile}"
SOURCE_LINE="[ -f \"$ENV_FILE\" ] && . \"$ENV_FILE\""

from_gh=0; dry=0; verify=1
for arg in "$@"; do
  case "$arg" in --from-gh) from_gh=1 ;; --dry-run) dry=1 ;; --no-verify) verify=0 ;; *) echo "unknown option: $arg" >&2; exit 2 ;; esac
done

if [ "$from_gh" = 1 ]; then
  token=$(gh auth token)
elif [ -t 0 ]; then
  cat >&2 <<'MSG'
Create a token for Crew workers:
  - Fine-grained (recommended): https://github.com/settings/personal-access-tokens/new
    Limit it to the repositories a Crew needs; grant read access to Issues, Pull
    requests, Contents and Metadata unless workers must write.
  - Or reuse your gh login with:  scripts/setup-github-token.sh --from-gh
    (that token carries the full access of your login)
MSG
  read -rsp "Paste the token: " token; echo >&2
else
  IFS= read -r token
fi
[[ "$token" =~ ^[A-Za-z0-9_]+$ ]] || { echo "That does not look like a GitHub token." >&2; exit 1; }

if [ "$verify" = 1 ]; then
  headers=$(mktemp); trap 'rm -f "$headers"' EXIT
  code=$(curl -s -o /dev/null -D "$headers" -w '%{http_code}' -H "Authorization: Bearer $token" https://api.github.com/user || true)
  [ "$code" = 200 ] || { echo "GitHub rejected the token (HTTP $code)." >&2; exit 1; }
  scopes=$(tr -d '\r' < "$headers" | sed -n 's/^[Xx]-[Oo]auth-[Ss]copes: //p')
  scopes=${scopes// /}
  echo "Token accepted${scopes:+; classic scopes: $scopes}." >&2
  case ",$scopes," in *,repo,*|*,workflow,*) echo "Note: this token can write to repositories. A fine-grained token with read access is safer." >&2 ;; esac
fi

if [ "$dry" = 1 ]; then
  echo "[dry-run] would write HALL_GITHUB_TOKEN to $ENV_FILE (mode 600) and source it from $PROFILE" >&2
  exit 0
fi
umask 077
mkdir -p "$(dirname "$ENV_FILE")"
printf "export HALL_GITHUB_TOKEN='%s'\n" "$token" > "$ENV_FILE"
chmod 600 "$ENV_FILE"
touch "$PROFILE"
grep -qsF "$SOURCE_LINE" "$PROFILE" || printf '\n# Hall Crew GitHub token\n%s\n' "$SOURCE_LINE" >> "$PROFILE"
echo "Saved to $ENV_FILE. Start a new shell, then start Pi from it." >&2
