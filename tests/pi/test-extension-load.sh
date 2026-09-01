#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/.pi"
cp -R "$ROOT/.pi/extensions" "$TMP/.pi/extensions"

if rg -n '(/Users/|/opt/|Workspace/|pi\.agents|pi\.tools\.call)' "$TMP/.pi/extensions"; then
  echo "Extension source contains a host-specific path or unsupported Pi API" >&2
  exit 1
fi

cd "$TMP"
PI_OFFLINE=1 pi \
  --no-extensions \
  --no-context-files \
  --no-skills \
  --no-prompt-templates \
  --no-themes \
  -e .pi/extensions/crew/index.ts \
  -e .pi/extensions/github/index.ts \
  -e .pi/extensions/web/index.ts \
  --list-models \
  --offline >/dev/null

echo "Pi extensions load from a relocated install tree"
