#!/usr/bin/env bash
# PreToolUse guard: block non-Hall skills when a Hall session is open

OPEN_MODE_FILE=".hall-cache/session/.open_mode"

# No session active — allow
if [ ! -f "$OPEN_MODE_FILE" ]; then
  exit 0
fi

# Extract skill name from tool input JSON (read env directly to avoid bash }-expansion issue)
SKILL=$(python3 -c "import json,os; print(json.loads(os.environ.get('CLAUDE_TOOL_INPUT','{}') or '{}').get('skill',''))" 2>/dev/null || echo "")

# No skill field present — allow
if [ -z "$SKILL" ]; then
  exit 0
fi

# Hall-native skills — allow
if [[ "$SKILL" == hall-of-automata-cli:* ]]; then
  exit 0
fi

# All other skills — suppress
echo "[Hall session active] Skill '${SKILL}' is suppressed. Use Old Major's Hall commands instead."
exit 1
