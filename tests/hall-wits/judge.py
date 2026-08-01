#!/usr/bin/env python3
"""Score a completed hall-wits run using Popotron — The Master of Wits.

Usage:
    judge.py <run_dir> <fixture_path>
             [--judge-model MODEL] [--test-model MODEL]

    run_dir       local directory produced by runner.py
    fixture_path  path within hall-wits-arena (e.g. fixtures/golden-path-01)
    --judge-model Claude model ID for the judge (default: claude-opus-5)
    --test-model  Claude model ID under test (default: claude-sonnet-4-6)

Env:
    ANTHROPIC_API_KEY     -- Anthropic API key
    HALL_WITS_ARENA_TOKEN -- GitHub PAT (read access to hall-wits-arena)
"""
import argparse
import json
import os
import sys

from _api import fetch_arena_text, call_judge, extract_json_block, verify_model_integrity


def extract_assistant_text(jsonl_path):
    messages = []
    try:
        with open(jsonl_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if ev.get("type") == "assistant":
                    for block in ev.get("message", {}).get("content", []):
                        if isinstance(block, dict) and block.get("type") == "text":
                            messages.append(block["text"])
    except FileNotFoundError:
        pass
    return "\n\n".join(messages)


def build_user_prompt(transcripts, plan_text, calibration, task_json):
    parts = [
        "## Fixture",
        json.dumps(task_json, indent=2),
        "## Groundtruth Calibration",
        json.dumps(calibration, indent=2),
        "## Turn 1 Transcript (assistant messages)",
        transcripts["turn_1"] or "(empty)",
        "## Turn 2 Transcript (assistant messages)",
        transcripts["turn_2"] or "(empty)",
        "## eval-dispatch-plan.json",
        plan_text or "(not produced)",
    ]
    return "\n\n".join(parts)


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


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("run_dir")
    p.add_argument("fixture_path")
    p.add_argument("--judge-model", default="claude-opus-5")
    p.add_argument("--test-model", default="claude-sonnet-4-6")
    args = p.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("error: ANTHROPIC_API_KEY not set")
    token = os.environ.get("HALL_WITS_ARENA_TOKEN")
    if not token:
        sys.exit("error: HALL_WITS_ARENA_TOKEN not set")

    ok, msg = verify_model_integrity(args.judge_model, args.test_model)
    if not ok:
        sys.exit(f"error: model integrity check failed -- {msg}")
    if msg != "ok":
        print(f"WARNING: {msg}")
    print(f"judge: {args.judge_model} | test: {args.test_model}")

    fixture = args.fixture_path.rstrip("/")
    rubric      = fetch_arena_text("judge/popotron.md", token)
    calibration = json.loads(fetch_arena_text(f"{fixture}/groundtruth/calibration.json", token))
    task_json   = json.loads(fetch_arena_text(f"{fixture}/task.json", token))

    run_dir = os.path.abspath(args.run_dir)
    transcripts = {
        "turn_1": extract_assistant_text(os.path.join(run_dir, "turn-1.jsonl")),
        "turn_2": extract_assistant_text(os.path.join(run_dir, "turn-2.jsonl")),
    }
    plan_path = os.path.join(run_dir, "eval-dispatch-plan.json")
    try:
        with open(plan_path) as f:
            plan_text = f.read()
    except FileNotFoundError:
        plan_text = ""

    user_prompt = build_user_prompt(transcripts, plan_text, calibration, task_json)
    print("calling judge model...")
    raw = call_judge(rubric, user_prompt, args.judge_model, api_key)

    block = extract_json_block(raw)
    if not block:
        sys.exit(f"error: no JSON block in judge response:\n{raw[:300]}")
    try:
        parsed = json.loads(block)
    except json.JSONDecodeError as e:
        sys.exit(f"error: invalid JSON in judge response: {e}\n{block[:300]}")

    dims = parsed.get("dimensions", [])
    mismatches = check_calibration_agreement(dims, calibration)

    with open(os.path.join(run_dir, "manifest.json")) as f:
        manifest = json.load(f)

    scores = {
        "run_id":                 manifest["run_id"],
        "fixture_id":             manifest["fixture_id"],
        "judge_model":            args.judge_model,
        "test_model":             args.test_model,
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


if __name__ == "__main__":
    main()
