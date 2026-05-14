# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin for the `claude-plugins-official` marketplace. The `plugin-dev` plugin (installed) has comprehensive skills for plugin structure, hooks, MCP integration, skill writing, and command development — use those for architecture guidance.

## Code quality

Files must be small enough to review in a single read. Hard ceiling: ~200 lines. Prefer many small focused files over fewer large ones. No duplicated logic. Code is written to be read.

This applies to everything in this repo: shell scripts, markdown skill files, templates, test files.

## Dev Commands

```bash
# Test the plugin locally
cc --plugin-dir /home/mike/Workspace/hall-of-automata-cli

# Debug plugin loading, hooks, MCP
cc --plugin-dir . --debug
```
