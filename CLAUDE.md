# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin for the `claude-plugins-official` marketplace. The `plugin-dev` plugin (installed) has comprehensive skills for plugin structure, hooks, MCP integration, skill writing, and command development — use those for architecture guidance.

## Dev Commands

```bash
# Test the plugin locally
cc --plugin-dir /home/mike/Workspace/hall-of-automata-cli

# Debug plugin loading, hooks, MCP
cc --plugin-dir . --debug
```
