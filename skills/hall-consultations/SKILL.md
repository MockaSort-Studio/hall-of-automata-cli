---
name: hall-consultations
description: List, view, or prune saved consultation memories
argument-hint: "list|view <id>|prune [--older-than <days>]"
allowed-tools: [Read, Edit, Bash]
---

# /hall:consultations [list|view <id>|prune]

Manage consultation artifacts saved in Claude memory. Consultation entries use `metadata.type: project` and names matching `consultation-<YYYYMMDD-HHmm>-<topic-slug>`.

## list (default)

Scan memory for entries whose names begin with `consultation-`. Display a table: name, description, date (parsed from name slug).

## view <id>

`<id>` is a full or partial name match against the name slug. Read and display the matched memory entry in full.

## prune [--older-than <days>]

Default: 90 days. Parse `YYYYMMDD` from entry names. List entries older than the threshold. Confirm with the invoker, then: remove each matched memory file and its MEMORY.md index line.
