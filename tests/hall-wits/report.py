#!/usr/bin/env python3
"""Format the hall-wits assessment report for posting as a GitHub PR comment.

Usage: report.py <run_dir> [--checker-out FILE]
Writes formatted markdown to stdout.
"""
import argparse
import json
import os
import re

ARENA_REF = "MockaSort-Studio/hall-wits-arena"


def read_text(path, fallback="(unavailable)"):
    try:
        with open(path) as f:
            return f.read().strip() or fallback
    except FileNotFoundError:
        return fallback


def defuse_issue_refs(text):
    """A bare #N in judge prose always means an issue in hall-wits-arena —
    that's the only repo the run touched. Two problems if left as plain
    markdown text: (1) this report is posted as a PR comment on
    hall-of-automata-cli, and GitHub auto-links bare #N to an issue in
    whatever repo the comment actually lives in — silently pointing every
    reference at an unrelated real issue in this repo's own history; (2)
    even a correctly cross-repo-qualified link ("owner/repo#N") would still
    resolve to nothing, since hall-wits-arena's cleanup step deletes every
    issue the run touched right after this report is generated. Wrapping in
    backticks renders it as inert code text — no link, wrong repo or dead
    one — while still telling a reader which repo the number belongs to.
    Skips refs already backtick-wrapped to avoid double-wrapping."""
    return re.sub(r'(?<!`)#(\d+)\b(?!`)', rf'`{ARENA_REF.split("/")[-1]}#\1`', text)


def format_judge_section(scores_path):
    try:
        with open(scores_path) as f:
            s = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return "(judge scores unavailable)", ""

    dims = s.get("dimensions", [])
    rows = "\n".join(
        f"| `{d.get('id', '?')}` | {d.get('score', '?')}/5 | "
        f"{defuse_issue_refs(d.get('justification', ''))[:120]} |"
        for d in dims
    )
    table = "| Dimension | Score | Justification |\n|---|---|---|\n" + rows if rows else "(no dimensions scored)"

    derivation_blocks = []
    for d in dims:
        derivation = d.get("derivation", "").strip()
        if derivation:
            derivation_blocks.append(
                f"<details>\n<summary><code>{d.get('id', '?')}</code> — full derivation</summary>\n\n"
                f"{defuse_issue_refs(derivation)}\n\n</details>"
            )
    if derivation_blocks:
        table = table + "\n\n" + "\n\n".join(derivation_blocks)

    overall  = s.get("overall", "?")
    cal_ok   = s.get("calibration_agreement", False)
    cal_mark = "✅" if cal_ok else "⚠️ mismatch"
    mismatches = s.get("calibration_mismatches", [])
    cal_detail = ""
    if mismatches:
        cal_detail = "\n\n**Calibration mismatches:**\n" + "\n".join(f"- {m}" for m in mismatches)
    assessment = defuse_issue_refs(s.get("assessment", "").strip())
    assessment_block = f"**Assessment:** {assessment}\n\n" if assessment else ""
    summary = f"{assessment_block}**Overall:** {overall}/5 | **Calibration:** {cal_mark}{cal_detail}"
    return table, summary


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("run_dir")
    p.add_argument("--checker-out", default="checker-output.txt")
    p.add_argument("--run-url", default="",
                    help="Actions run URL — the durable audit trail, since "
                         "hall-wits-arena's issues are deleted right after "
                         "this report is generated")
    args = p.parse_args()

    manifest_path = os.path.join(args.run_dir, "manifest.json")
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
        run_id     = manifest.get("run_id", "?")
        fixture_id = manifest.get("fixture_id", "?")
    except (FileNotFoundError, json.JSONDecodeError):
        run_id = fixture_id = "?"

    checker_out = read_text(args.checker_out)
    judge_table, judge_summary = format_judge_section(
        os.path.join(args.run_dir, "judge-scores.json")
    )

    audit_note = (
        f"\n[Full run detail — transcripts, tool calls, raw judge output]({args.run_url})\n"
        if args.run_url else ""
    )

    print(f"""\
## Hall Wits Assessment — {fixture_id}

**Run:** `{run_id}` | **Fixture:** `{fixture_id}`

### Structural Checks (State Model)

```
{checker_out}
```

### Judge Scores (Popotron — Master of Wits)

{judge_table}

{judge_summary}

Issue numbers above are `hall-wits-arena` references, shown as plain text —
that repo is reset and every issue the run touched is deleted right after
this report is generated, so a live link would either point at the wrong
repo or at nothing at all.
{audit_note}
---
*// Popotron \U0001f52e — pipeline sealed*""")


if __name__ == "__main__":
    main()
