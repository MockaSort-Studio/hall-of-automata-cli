#!/usr/bin/env python3
"""Snapshot every issue this run touched to JSON before cleanup deletes them.

Usage: snapshot.py <run_id> <run_dir> [--project-number N]

    run_id           short run identifier (e.g. run-a3f9c1)
    run_dir          local run directory containing manifest.json
    --project-number Projects v2 board number, to also capture field values

hall-wits-arena is reset after every run — the live issues, their bodies,
labels, sub-issue wiring, and board field values are all gone by the time a
human reads Popotron's report. This writes the same run:<run_id>-matched
issue set cleanup.py finds (label + created_at > provisioned_at) to
github-snapshot.json in run_dir, which the workflow already uploads as part
of the run artifact — the durable audit trail once the live state is gone.

Token: HALL_WITS_ARENA_TOKEN env var
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import cleanup  # noqa: E402 — reuse its run-matching (label + timestamp)
import checker  # noqa: E402 — reuse its board-field GraphQL query


def snapshot(run_id, run_dir, project_number, token):
    label = f"run:{run_id}"
    issues = cleanup.list_issues(label, run_dir, token)
    entries = []
    for issue in sorted(issues, key=lambda i: i["number"]):
        num = issue["number"]
        subs = cleanup.gh("GET", f"/repos/{cleanup.OWNER}/{cleanup.REPO}/issues/{num}/sub_issues",
                           token) or []
        entry = {
            "number": num,
            "title": issue.get("title"),
            "state": issue.get("state"),
            "state_reason": issue.get("state_reason"),
            "labels": [l["name"] for l in issue.get("labels", [])],
            "body": issue.get("body"),
            "created_at": issue.get("created_at"),
            "closed_at": issue.get("closed_at"),
            "html_url": issue.get("html_url"),
            "sub_issues": [s["number"] for s in subs],
        }
        if project_number:
            entry["board_fields"] = checker._project_item_fields(
                cleanup.OWNER, cleanup.REPO, num, project_number, token)
        entries.append(entry)
    return entries


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("run_id")
    p.add_argument("run_dir")
    p.add_argument("--project-number", type=int, default=None)
    args = p.parse_args()

    token = os.environ.get("HALL_WITS_ARENA_TOKEN")
    if not token:
        sys.exit("error: HALL_WITS_ARENA_TOKEN not set")

    entries = snapshot(args.run_id, args.run_dir, args.project_number, token)
    out_path = os.path.join(args.run_dir, "github-snapshot.json")
    with open(out_path, "w") as f:
        json.dump({"run_id": args.run_id, "issues": entries}, f, indent=2)
    print(f"snapshot -> {out_path} ({len(entries)} issue(s))")


if __name__ == "__main__":
    main()
