#!/usr/bin/env python3
"""Write judge-scores.json from JUDGE_STRUCTURED_OUTPUT env var.

Usage:
    judge-scores.py <run_dir> [--judge-model MODEL] [--test-model MODEL]

Env:
    JUDGE_STRUCTURED_OUTPUT  structured output JSON from claude-code-action
"""
import argparse
import json
import os
import sys


def check_calibration_agreement(dims, calibration):
    cal_dims = calibration.get("dimensions", [])
    cal_map = {d["id"]: d for d in cal_dims}
    dim_ids = {dim["id"] for dim in dims}
    mismatches = []
    for dim in dims:
        cal = cal_map.get(dim["id"])
        if not cal:
            continue
        min_s = cal.get("expected_score_min", 3)
        direction = cal.get("direction", "high")
        passing = dim["score"] >= min_s if direction == "high" else dim["score"] < min_s
        if not passing:
            mismatches.append(
                f'{dim["id"]}: scored {dim["score"]}, '
                f'expected {direction} (min {min_s})'
            )
    for cal_dim in cal_dims:
        if cal_dim["id"] not in dim_ids:
            mismatches.append(f'{cal_dim["id"]}: missing from judge response')
    return mismatches


def collect(run_dir, judge_model, test_model):
    raw = os.environ.get("JUDGE_STRUCTURED_OUTPUT", "")
    if not raw:
        sys.exit("error: JUDGE_STRUCTURED_OUTPUT not set")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.exit(f"error: invalid JSON in JUDGE_STRUCTURED_OUTPUT: {e}\n{raw[:300]}")

    with open(os.path.join(run_dir, "calibration.json")) as f:
        calibration = json.load(f)

    with open(os.path.join(run_dir, "manifest.json")) as f:
        manifest = json.load(f)

    dims = parsed.get("dimensions", [])
    mismatches = check_calibration_agreement(dims, calibration)

    scores = {
        "run_id":                 manifest["run_id"],
        "fixture_id":             manifest["fixture_id"],
        "judge_model":            judge_model,
        "test_model":             test_model,
        "dimensions":             dims,
        "overall":                round(sum(d["score"] for d in dims) / len(dims), 2) if dims else 0,
        "calibration_agreement":  len(mismatches) == 0,
        "calibration_mismatches": mismatches,
    }

    out_path = os.path.join(run_dir, "judge-scores.json")
    with open(out_path, "w") as f:
        f.write(json.dumps(scores, indent=2) + "\n")
    print(f"scores -> {out_path}")
    for d in dims:
        print(f"  [{d['score']}/5] {d['id']}: {d['justification'][:80]}")

    if mismatches:
        print(f"\nWARNING: calibration direction mismatch on {len(mismatches)} dimension(s):")
        for m in mismatches:
            print(f"  {m}")
        sys.exit(1)
    print("\ncalibration agreement: ✅")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("run_dir")
    p.add_argument("--judge-model", default="claude-opus-5")
    p.add_argument("--test-model", default="claude-sonnet-4-6")
    args = p.parse_args()
    collect(os.path.abspath(args.run_dir), args.judge_model, args.test_model)


if __name__ == "__main__":
    main()
