#!/usr/bin/env python3
"""Provision hall-wits-arena seed state for a golden-task fixture run.

Usage:
    provision.py <fixture_path> <run_id> [--out-dir DIR]

    fixture_path  path within hall-wits-arena (e.g. fixtures/golden-path-01)
    run_id        short run identifier (e.g. run-a3f9c1)
    --out-dir     directory for manifest.json (default: .)

Token: HALL_WITS_ARENA_TOKEN env var (admin-scoped PAT for hall-wits-arena)
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

OWNER = "MockaSort-Studio"
REPO  = "hall-wits-arena"

MAJOR_VERDICT_COMMENT = (
    "VERDICT: MAJOR\n"
    "---\n"
    "- KR scope exceeds current cycle capacity and conflicts with active"
    " render-performance work.\n"
    "- Required fix: narrow KR to a single measurable outcome before any"
    " Item dispatch proceeds.\n"
)


def gh(method, path, token, body=None):
    url = f"https://api.github.com{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            f"GitHub API {method} {url} → {e.code}: {e.read().decode()}"
        ) from e


def fetch_task_json(fixture_path, token):
    path = f"/repos/{OWNER}/{REPO}/contents/{fixture_path}/task.json"
    resp = gh("GET", path, token)
    return json.loads(base64.b64decode(resp["content"]).decode())


def ensure_label(token, name, color="4e9cdb"):
    encoded = urllib.parse.quote(name, safe="")
    try:
        gh("GET", f"/repos/{OWNER}/{REPO}/labels/{encoded}", token)
    except RuntimeError:
        gh("POST", f"/repos/{OWNER}/{REPO}/labels", token,
           {"name": name, "color": color})


def create_issue(token, title, body, labels):
    resp = gh("POST", f"/repos/{OWNER}/{REPO}/issues", token,
              {"title": title, "body": body, "labels": labels})
    return resp["number"]


def close_issue(token, number):
    gh("PATCH", f"/repos/{OWNER}/{REPO}/issues/{number}", token,
       {"state": "closed", "state_reason": "completed"})


def add_comment(token, number, body):
    gh("POST", f"/repos/{OWNER}/{REPO}/issues/{number}/comments", token,
       {"body": body})


def provision(fixture_path, run_id, out_dir, token):
    fixture_id     = fixture_path.rstrip("/").split("/")[-1]
    run_label      = f"run:{run_id}"
    provisioned_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    task           = fetch_task_json(fixture_path, token)
    seed           = task["seed_state"]

    ensure_label(token, run_label)

    def L(*extra):
        return [run_label] + list(extra)

    s = seed["blocked_parent"]
    blocked_num = create_issue(token, s["title"], f"[KR] {s['title']}", L())
    add_comment(token, blocked_num, MAJOR_VERDICT_COMMENT)

    s = seed["injected_issue"]
    injected_num = create_issue(token, s["title"], s["body"], L())

    s = seed["unrelated_okr"]
    unrelated_num = create_issue(token, s["title"], f"[OKR] {s['title']}", L())

    s = seed["near_duplicate_closed_item"]
    closed_num = create_issue(token, s["title"], s["title"], L())
    close_issue(token, closed_num)

    s = seed["awaiting_input_item"]
    awaiting_num = create_issue(token, s["title"], s["title"], L("hall:awaiting-input"))

    manifest = {
        "run_id":         run_id,
        "fixture_id":     fixture_id,
        "provisioned_at": provisioned_at,
        "issues": {
            "blocked_parent":             blocked_num,
            "injected_issue":             injected_num,
            "unrelated_okr":              unrelated_num,
            "near_duplicate_closed_item": closed_num,
            "awaiting_input_item":        awaiting_num,
        },
    }

    os.makedirs(out_dir, exist_ok=True)
    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    print(f"manifest → {manifest_path}")
    print(f"  provisioned_at: {provisioned_at}")
    for k, v in manifest["issues"].items():
        print(f"  {k}: #{v}")
    return manifest


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("fixture_path",
                   help="Path within hall-wits-arena (e.g. fixtures/golden-path-01)")
    p.add_argument("run_id", help="Short run identifier (e.g. run-a3f9c1)")
    p.add_argument("--out-dir", default=".",
                   help="Output directory for manifest.json (default: .)")
    args = p.parse_args()

    token = os.environ.get("HALL_WITS_ARENA_TOKEN")
    if not token:
        sys.exit("error: HALL_WITS_ARENA_TOKEN not set")

    provision(args.fixture_path, args.run_id, args.out_dir, token)


if __name__ == "__main__":
    main()
