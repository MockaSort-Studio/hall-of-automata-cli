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

In `MockaSort-Studio/marketplace`, edit `plugins.json` — bump the `latest` field for `hall-of-automata`:

```json
{ "latest": "0.2.0", ... }
```

Also update the `README.md` version table. Open a PR or push directly to `main`.

```bash
gh api repos/MockaSort-Studio/marketplace/contents/plugins.json \
  --method PUT \
  --field message="chore: bump hall-of-automata to v0.2.0" \
  --field content="$(cat plugins.json | base64)"
```

### 5. Verify install

```bash
curl -sL https://raw.githubusercontent.com/MockaSort-Studio/marketplace/main/install.sh | bash -s hall-of-automata
```

Confirm the installed version matches the tag.
