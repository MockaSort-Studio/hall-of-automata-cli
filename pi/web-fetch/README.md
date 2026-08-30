# web-fetch

Minimal, dependency-free web fetch for Fabric actors — Node 24+ native
`fetch`, no MCP server, no external dependency. Part of our own tool
taxonomy (`web.fetch`), built as a small native Pi/Fabric capability:
purpose-built, small, fully controlled.

Not used by KR 7.2's current dispatches (GitHub-only consultation) — built
ahead for KR 7.3, where `hall-saga` Phase 3 (research/fact-checking) will
need real web content, not just GitHub reads.

```
node cli.mjs --url https://example.com [--max-chars 20000]
```

Strips `<script>`/`<style>`/comments/tags down to readable text when the
response is HTML; returns raw text otherwise. Output is truncated (default
20,000 chars) with `truncated: true` when cut — mesh events cap at 256 KiB,
so a specialist publishing a fetch result over mesh needs a bounded input.
