#!/usr/bin/env bash
set -euo pipefail

PASS=0; FAIL=0

check() {
  local desc="$1"; local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"; FAIL=$((FAIL + 1))
  fi
}

echo "=== Plugin scaffold validation ==="
check "plugin.json exists"        "test -f .claude-plugin/plugin.json"
check "plugin.json valid JSON"    "python3 -m json.tool .claude-plugin/plugin.json"
check "plugin name is kebab-case" "python3 -c \"import json,re,sys; d=json.load(open('.claude-plugin/plugin.json')); sys.exit(0 if re.match(r'^[a-z][a-z0-9]*(-[a-z0-9]+)*$', d['name']) else 1)\""
check ".mcp.json exists"          "test -f .mcp.json"
check ".mcp.json valid JSON"      "python3 -m json.tool .mcp.json"
check "mcpServers has sequential-thinking" "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'sequential-thinking' in d else 1)\""
check "mcpServers has fetch"      "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'fetch' in d else 1)\""
check "mcpServers has github"        "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'github' in d else 1)\""
check "mcpServers has google-drive"  "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'google-drive' in d else 1)\""

echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
