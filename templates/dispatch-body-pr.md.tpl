<!-- Hall dispatch by Old Major (Session Mode) -->
saga: <wiki URL of open saga for this project; empty string if none>

## Working repository

All work for this task — branch, commits, and the final PR — must be created in **`<ORG/REPO>`**. Do not create branches or PRs on any other repository.

## Summary

<one paragraph description of the task>

## Acceptance criteria

<what done looks like>

## Context

<relevant context the specialist needs — existing code references, design decisions, constraints>

## Prior context

<from prior-context step — omit section entirely if no relevant prior issues found>

## Routing

Assigned to <Specialist>. Rationale: <routing_rationale text>

## Dependencies

<list of parent tasks that have completed, with their PR links>

## Code quality

Applies to all files produced by this task, regardless of language or framework:

- **Size:** ≤200 lines per file. Hard ceiling — not a guideline.
- **Readable:** clear, descriptive names; no magic values; no clever one-liners that obscure intent.
- **Reusable:** no copy-paste logic — extract functions for anything used more than once.
- **Modular:** single responsibility per file and per function. A file that does two things should be two files.

If the natural implementation would exceed 200 lines for any file, decompose further and raise with Old Major before proceeding.
