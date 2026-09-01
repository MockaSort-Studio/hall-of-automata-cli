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

cat > "$TMP/assert-tools.ts" <<'EOF'
export default function (pi) {
  const available = new Set(pi.getAllTools().map(tool => tool.name));
  const required = [
    "start_crew", "build_crew_member", "crew_register", "crew_close",
    "github_issue_view", "github_issue_remove_label", "github_discussions_list",
    "web_fetch",
  ];
  const missing = required.filter(name => !available.has(name));
  if (missing.length) throw new Error(`Missing registered tools: ${missing.join(", ")}`);
}
EOF

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
  -e ./assert-tools.ts \
  --list-models \
  --offline >/dev/null

echo "Pi extensions load from a relocated install tree"
