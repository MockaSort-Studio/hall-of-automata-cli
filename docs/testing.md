# Testing the Hall of Automata Plugin


## Automated (no Hall connection needed)

Run these from the repo root:

```bash
# Full plugin structure validation (73 checks)
bash tests/validate-plugin.sh

# Hook unit tests
bash tests/hooks/test-guard-writes.sh
bash tests/hooks/test-session-start.sh
bash tests/hooks/test-watcher.sh
bash tests/hooks/test-skill-guard.sh
```

All should exit `0`. These tests cover:
- Plugin manifest fields and path resolution
- Skill file presence and frontmatter
- Hook registration and script syntax
- Template placeholder presence
- `.gitignore` entries
- Guard-writes allow/block logic (including path traversal)
- Session-start resume prompt
- Watcher `--once` mode and PID lifecycle

