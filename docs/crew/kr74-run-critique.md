# KR 7.4 Crew Run Critique

Run: `82b94656-da13-4f64-b862-086ecaaae64f`  
Discussion: [#396](https://github.com/MockaSort-Studio/hall-of-automata-cli/discussions/396)  
Outcome: `BLOCKED`

## What worked

- One Lead selected the smallest credible Crew: an executor and an independent gate auditor.
- Kickoff was concise, structured, and free of repeated links or transport labels.
- Both specialists independently found the same structural blocker from different evidence.
- The auditor reviewed the executor criterion by criterion in a GitHub reply thread.
- The Lead accepted each finding separately, preserved the release gate, wrote the report,
  closed the Discussion, emitted `FINAL`, and removed all three actors.
- The first Lead batch failed on a nonexistent file; the durable actor resumed without an
  observer wakeup or steering message.

## What should improve

- The Lead guessed `roles/specialist.mjs` and old roster paths instead of listing first. The
  failed fan-out added latency and context without evidence.
- Context grew aggressively: Lead 6,741→84,529 tokens, executor 4,702→81,181, and auditor
  4,897→53,969. Large source/tool outputs should be summarized before entering warm context.
- Discussion threading improved but remained partial: six top-level comments had one reply.
  Reviews and qualifications should attach to their triggering finding where GitHub permits.
- `crew_close` renders “Final acceptance” even when the accepted result is `BLOCKED`. The
  template should carry an explicit outcome separate from evidence acceptance.
- The artifact was local and untracked at close time. A GitHub URL is durable only after the
  artifact is committed or otherwise published.
- Actor removal deleted actor-local session files before observer metrics collection. Metrics
  currently depend on Pi's separate retained session records.
- Actor disband succeeded, but the resident launcher/RPC child did not exit. The Fabric fix is
  documented in `fabric-upstream-work-log.md`.

## Recommended next protocol work

1. Require list/search before speculative reads in Lead startup.
2. Bound and summarize source reads to control warm-context growth.
3. Extend reply threading to reviews where the source comment ID is available.
4. Add `PASS | BLOCKED | FAIL` to final-close rendering.
5. Publish the artifact before final close.
6. Snapshot runtime/context metrics before actor removal.
