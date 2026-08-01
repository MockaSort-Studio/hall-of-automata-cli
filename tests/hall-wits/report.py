#!/usr/bin/env python3
"""Format the hall-wits assessment report for posting as a GitHub PR comment.

Usage: report.py <run_dir> [--checker-out FILE]
Writes formatted markdown to stdout.
"""
import argparse
import json
import os


def read_text(path, fallback="(unavailable)"):
    try:
        with open(path) as f:
            return f.read().strip() or fallback
    except FileNotFoundError:
        return fallback


def format_judge_section(scores_path):
    try:
        with open(scores_path) as f:
            s = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return "(judge scores unavailable)", ""

    dims = s.get("dimensions", [])
    rows = "\n".join(
        f"| `{d.get('id', '?')}` | {d.get('score', '?')}/5 | {d.get('justification', '')[:80]} |"
        for d in dims
    )
    table = "| Dimension | Score | Justification |\n|---|---|---|\n" + rows if rows else "(no dimensions scored)"
    overall  = s.get("overall", "?")
    cal_ok   = s.get("calibration_agreement", False)
    cal_mark = "✅" if cal_ok else "⚠️ mismatch"
    mismatches = s.get("calibration_mismatches", [])
    cal_detail = ""
    if mismatches:
        cal_detail = "\n\n**Calibration mismatches:**\n" + "\n".join(f"- {m}" for m in mismatches)
    summary = f"**Overall:** {overall}/5 | **Calibration:** {cal_mark}{cal_detail}"
    return table, summary


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("run_dir")
    p.add_argument("--checker-out", default="checker-output.txt")
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

---
*// Mergio \U0001f918 — pipeline sealed*""")


if __name__ == "__main__":
    main()
