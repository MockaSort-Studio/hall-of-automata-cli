# Releasing hall-of-automata

Distribution is via the [MockaSort marketplace](https://github.com/MockaSort-Studio/marketplace), not the official Claude Code marketplace. Hall plugins are designed to work alongside Hall infrastructure and have no reason to go through Anthropic's submission process.

## Pre-release checklist

- [ ] All tests pass: `bash tests/validate-plugin.sh`
- [ ] Hook tests pass: `bash tests/hooks/test-guard-writes.sh && bash tests/hooks/test-session-start.sh && bash tests/hooks/test-watcher.sh`
- [ ] `.claude-plugin/plugin.json` version bumped (semver)
- [ ] `CHANGELOG.md` updated (create if absent)
- [ ] No uncommitted changes: `git status`

## Steps

### 1. Bump version

Edit `.claude-plugin/plugin.json`:
```json
{ "version": "0.2.0", ... }
```

Commit: `git commit -am "chore: bump version to 0.2.0"`

### 2. Tag

```bash
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin master --tags
```

### 3. Create GitHub release

```bash
gh release create v0.2.0 --title "v0.2.0" --notes "$(cat CHANGELOG.md | head -50)"
```

### 4. Update marketplace registry

The marketplace at `MockaSort-Studio/marketplace` points to the GitHub repo directly — no pinned version. Users who run `/plugin marketplace update mocksort` get the latest commit automatically. No manual registry update needed for rolling releases.

To pin to a specific release tag, edit `.claude-plugin/marketplace.json` in `MockaSort-Studio/marketplace` — add a `ref` to the source:

```json
{ "name": "hall-of-automata-cli", "source": { "source": "github", "repo": "MockaSort-Studio/hall-of-automata-cli", "ref": "v0.2.0" }, ... }
```

### 5. Verify install

From within Claude Code:

```
/plugin marketplace update mocksort
/plugin install hall-of-automata-cli@mocksort
```
