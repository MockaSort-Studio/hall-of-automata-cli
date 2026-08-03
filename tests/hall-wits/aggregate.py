#!/usr/bin/env python3
"""Aggregate N golden-path-01 iteration results into one summary.

Usage: aggregate.py <iterations_dir>

    iterations_dir   directory containing one subdirectory per downloaded
                      iteration artifact — the shape actions/download-artifact
                      produces when downloading multiple artifacts matched by
                      a name pattern into a single path.

A single run's score is a noisy sample — the same fixture has scored
anywhere from ~1.6 to ~4.9/5 across runs with no code changes between them,
purely from run-to-run variance in the test model and the judge model. This
reads N independently-run iterations (siblings, not a retry chain) and
reports pass rates and score distributions instead of one point estimate.

Writes formatted markdown to stdout.
"""
import json
import os
import statistics
import sys


def _load_runs(iterations_dir):
    runs = []
    for entry in sorted(os.listdir(iterations_dir)):
        run_path = os.path.join(iterations_dir, entry)
        if not os.path.isdir(run_path):
            continue
        checker_out_path = os.path.join(run_path, "checker-output.txt")
        scores_path = os.path.join(run_path, "run-dir", "judge-scores.json")

        checker_out = ""
        if os.path.exists(checker_out_path):
            with open(checker_out_path) as f:
                checker_out = f.read()

        scores = {}
        if os.path.exists(scores_path):
            try:
                with open(scores_path) as f:
                    scores = json.load(f)
            except json.JSONDecodeError:
                scores = {}

        runs.append({"name": entry, "checker_out": checker_out, "scores": scores})
    return runs


def check_pass_rates(runs):
    """name -> {"pass": n, "fail": n, "skip": n}, in first-seen order."""
    counts = {}
    for run in runs:
        for line in run["checker_out"].splitlines():
            line = line.strip()
            if not line:
                continue
            symbol, _, rest = line.partition(" ")
            name = rest.split(":", 1)[0].strip()
            if not name:
                continue
            bucket = counts.setdefault(name, {"pass": 0, "fail": 0, "skip": 0})
            if symbol == "✅":
                bucket["pass"] += 1
            elif symbol == "❌":
                bucket["fail"] += 1
            elif symbol == "⏭️":
                bucket["skip"] += 1
    return counts


def dimension_stats(runs):
    """dimension id -> {mean, min, max, n}, in first-seen order."""
    per_dim = {}
    for run in runs:
        for d in run["scores"].get("dimensions", []):
            per_dim.setdefault(d["id"], []).append(d["score"])
    stats = {}
    for dim, scores in per_dim.items():
        stats[dim] = {
            "mean": round(statistics.mean(scores), 2),
            "min": min(scores),
            "max": max(scores),
            "n": len(scores),
        }
    return stats


def format_report(runs):
    n = len(runs)
    lines = [f"## Hall Wits Assessment — golden-path-01 ({n} iteration{'s' if n != 1 else ''})\n"]

    if n == 0:
        lines.append("No iteration artifacts found.")
        return "\n".join(lines)

    counts = check_pass_rates(runs)
    lines.append("### Structural Checks — pass rate across iterations\n")
    for name, c in counts.items():
        total = c["pass"] + c["fail"] + c["skip"]
        symbol = "❌" if c["fail"] else "✅"
        detail = f"{c['pass']}/{total} passed"
        if c["skip"]:
            detail += f", {c['skip']} skipped"
        lines.append(f"{symbol} `{name}`: {detail}")

    stats = dimension_stats(runs)
    lines.append("\n### Judge Scores — mean across iterations (Popotron)\n")
    lines.append("| Dimension | Mean | Range | N |")
    lines.append("|---|---|---|---|")
    for dim, s in stats.items():
        lines.append(f"| `{dim}` | {s['mean']}/5 | {s['min']}–{s['max']} | {s['n']} |")

    overalls = [r["scores"]["overall"] for r in runs if "overall" in r["scores"]]
    if overalls:
        lines.append(
            f"\n**Overall mean:** {round(statistics.mean(overalls), 2)}/5 "
            f"(range {min(overalls)}–{max(overalls)}, n={len(overalls)})"
        )

    cal = [r["scores"]["calibration_agreement"] for r in runs if "calibration_agreement" in r["scores"]]
    if cal:
        lines.append(f"**Calibration agreement:** {sum(1 for c in cal if c)}/{len(cal)} iterations")

    lines.append("\n### Per-iteration summary\n")
    lines.append("| # | Artifact | Overall | Calibration | Structural |")
    lines.append("|---|---|---|---|---|")
    for i, run in enumerate(runs, 1):
        overall = run["scores"].get("overall", "?")
        cal_mark = "✅" if run["scores"].get("calibration_agreement") else "⚠️"
        fails = sum(1 for line in run["checker_out"].splitlines() if line.strip().startswith("❌"))
        struct = "✅ all pass" if fails == 0 else f"❌ {fails} failed"
        lines.append(f"| {i} | `{run['name']}` | {overall}/5 | {cal_mark} | {struct} |")

    lines.append(
        "\nFull transcripts, tool calls, and per-iteration judge derivations are in each "
        "iteration's uploaded run artifact (`hall-wits-run-*`), downloadable from this "
        "workflow run's Summary page."
    )
    lines.append("\n---\n*// Popotron 🔮 — pipeline sealed (aggregated)*")
    return "\n".join(lines)


def structural_ok(run):
    return not any(line.strip().startswith("❌") for line in run["checker_out"].splitlines())


def release_verdict(runs):
    """Release gate policy: unanimous structural checks, majority calibration.

    Structural checks are deterministic verification of what Old Major
    actually did to real GitHub state — any failure is a real bug and
    always blocks. Calibration agreement is Popotron's subjective score,
    with acknowledged run-to-run noise — 2 of 3 agreeing is enough.
    """
    if not runs:
        return False, ["no iteration artifacts found"]
    reasons = []
    failing = [r["name"] for r in runs if not structural_ok(r)]
    if failing:
        reasons.append(f"structural checks failed in: {', '.join(failing)}")
    cal = [r["scores"]["calibration_agreement"] for r in runs if "calibration_agreement" in r["scores"]]
    agree = sum(1 for c in cal if c)
    if not cal or agree * 2 < len(cal):
        reasons.append(f"calibration agreement {agree}/{len(cal)} — majority required")
    return (not reasons), reasons


def main():
    args = [a for a in sys.argv[1:] if a != "--verdict"]
    verdict_mode = "--verdict" in sys.argv[1:]
    if len(args) != 1:
        sys.exit("usage: aggregate.py <iterations_dir> [--verdict]")

    runs = _load_runs(args[0])
    if verdict_mode:
        ok, reasons = release_verdict(runs)
        for reason in reasons:
            print(f"::error::{reason}")
        sys.exit(0 if ok else 1)

    print(format_report(runs))


if __name__ == "__main__":
    main()
