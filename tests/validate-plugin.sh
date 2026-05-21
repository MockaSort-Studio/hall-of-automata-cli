#!/usr/bin/env bash
set -euo pipefail

PASS=0; FAIL=0

check() {
  local desc="$1"; local cmd="$2"
  if bash -c "$cmd" &>/dev/null; then
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
check "mcp.json has sequential-thinking" "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'sequential-thinking' in d else 1)\""
check "mcp.json has fetch"      "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'fetch' in d else 1)\""
check "mcp.json has github"        "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'github' in d else 1)\""
check "mcp.json has google-drive"  "python3 -c \"import json,sys; d=json.load(open('.mcp.json')); sys.exit(0 if 'google-drive' in d else 1)\""
check "plan.json.schema is valid JSON"  "python3 -m json.tool templates/plan.json.schema"

# Skills
for CMD in hall-doctor hall-open hall-close hall-status hall-plan hall-dispatch hall-reply hall-reconcile hall-consultations hall-prune; do
  check "skills/$CMD/SKILL.md exists" "test -f skills/$CMD/SKILL.md"
  check "skills/$CMD/SKILL.md has frontmatter" "grep -q '^---' skills/$CMD/SKILL.md"
  check "skills/$CMD/SKILL.md has name field" "grep -q '^name:' skills/$CMD/SKILL.md"
done

# Methodology
for F in old-major-local-overlay decomposition consultation-router routing-rationale; do
  check "methodology/$F.md exists" "test -f methodology/$F.md"
done

# Templates
check "templates/CLAUDE-stack.md.tpl exists"        "test -f templates/CLAUDE-stack.md.tpl"
check "templates/subagent-overlay.md.tpl exists"    "test -f templates/subagent-overlay.md.tpl"
check "templates/plan.json.schema exists"            "test -f templates/plan.json.schema"
check "CLAUDE-stack template has roster-index import"       "grep -q 'roster-index.md' templates/CLAUDE-stack.md.tpl"
check "subagent template has SPECIALIST_NAME"        "grep -q 'SPECIALIST_NAME' templates/subagent-overlay.md.tpl"
check "subagent template has PERSONA_PATH"           "grep -q 'PERSONA_PATH' templates/subagent-overlay.md.tpl"

# Template @-import guard: overlay templates loaded via Read must not contain @-import lines
for TPL in templates/*-overlay.md.tpl; do
  check "No unresolved @-imports in $(basename "$TPL")" \
    "! sed 's/{{[^}]*}}/DUMMY/g' \"$TPL\" | grep -q '^@'"
done

# Hooks
check "hooks/hooks.json valid JSON"            "python3 -m json.tool hooks/hooks.json"
check "hooks/scripts/guard-writes.sh exists"   "test -f hooks/scripts/guard-writes.sh"
check "hooks/scripts/session-start.sh exists"  "test -f hooks/scripts/session-start.sh"
check "hooks/scripts/watcher.sh exists"        "test -f hooks/scripts/watcher.sh"
check "guard-writes.sh is executable"          "test -x hooks/scripts/guard-writes.sh"
check "watcher.sh is executable"               "test -x hooks/scripts/watcher.sh"

# .gitignore
check ".hall-cache/ in .gitignore"             "grep -q '\.hall-cache' .gitignore"

echo; echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
