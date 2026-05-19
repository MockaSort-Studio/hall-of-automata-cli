#!/usr/bin/env bash
# Install hall-of-automata plugin for Claude Code
# Usage: curl -sL https://raw.githubusercontent.com/MockaSort-Studio/hall-of-automata-cli/master/scripts/install.sh | bash
#        or: bash scripts/install.sh [install-dir]
set -euo pipefail

REPO="https://github.com/MockaSort-Studio/hall-of-automata-cli.git"
INSTALL_DIR="${1:-$HOME/.claude/plugins/hall-of-automata}"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing install at $INSTALL_DIR..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "Installing to $INSTALL_DIR..."
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
fi

echo
echo "Done. Add to your Claude Code session:"
echo
echo "  cc --plugin-dir \"$INSTALL_DIR\""
echo
echo "Or set permanently in your shell profile:"
echo
echo "  export CLAUDE_PLUGIN_DIR=\"$INSTALL_DIR\""
