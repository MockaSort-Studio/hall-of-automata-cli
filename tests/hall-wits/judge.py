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
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request

ARENA_OWNER  = "MockaSort-Studio"
ARENA_REPO   = "hall-wits-arena"
ANTHROPIC_API = "https://api.anthropic.com/v1/messages"

# Descending capability order; judge rank must be <= test rank (lower index = more capable).
MODEL_CAPABILITY = [
    "claude-fable-5",
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
]


def _gh_get(path, token):
    url = f"https://api.github.com{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"GET {url} -> {e.code}: {e.read().decode()}") from e


def fetch_arena_text(path, token):
    resp = _gh_get(f"/repos/{ARENA_OWNER}/{ARENA_REPO}/contents/{path}", token)
    return base64.b64decode(resp["content"]).decode()


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


def call_judge(system_prompt, user_prompt, model, api_key):
    body = json.dumps({
        "model": model,
        "max_tokens": 2048,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }).encode()
    req = urllib.request.Request(
        ANTHROPIC_API, data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            resp = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Anthropic API -> {e.code}: {e.read().decode()}") from e
    return resp["content"][0]["text"]


def extract_json_block(text):
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        return fenced.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return ""
    return text[start:end + 1]


def verify_model_integrity(judge_model, test_model):
    if judge_model == test_model:
        return False, f"judge model == test model ({judge_model})"

    def rank(m):
        return next((i for i, c in enumerate(MODEL_CAPABILITY)
                     if m.startswith(c) or c.startswith(m)), None)

    ji, ti = rank(judge_model), rank(test_model)
    if ji is None or ti is None:
        return True, "unknown model(s) -- skipping capability check"
    if ji > ti:
        return False, (f"judge ({judge_model}, rank {ji}) is less capable "
                       f"than test ({test_model}, rank {ti})")
    return True, "ok"


def check_calibration_agreement(dims, calibration):
    cal_map = {d["id"]: d for d in calibration.get("dimensions", [])}
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
    plan_text = open(plan_path).read() if os.path.exists(plan_path) else ""

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
