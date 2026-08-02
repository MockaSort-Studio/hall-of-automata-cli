#!/usr/bin/env python3
"""Delete run-created issues in hall-wits-arena; verify and delete the run label.

Usage: cleanup.py <run_id> [run_dir] [--dry-run | --delete-label]

    run_id          short run identifier (e.g. run-a3f9c1)
    run_dir         local run directory containing manifest.json — enables
                     timestamp-based matching (created_at > provisioned_at) in
                     addition to the run:<run_id> label. Without it, only
                     label-matched issues are found.
    --dry-run       verify zero issues remain from this run; exit 1 if any found
    --delete-label  delete the run label — only call after --dry-run confirms clean

provision.py labels the issues it seeds with run:<run_id>, but anything Old
Major creates during the run itself (the actual OKR/KR/Item deliverables) has
no reason to know about eval-harness run labels — the real plugin skills don't
apply them. Label-only matching missed those entirely; they stayed open and
accumulated across every run that ever produced real output. run_dir closes
that gap by also matching on manifest.json's provisioned_at timestamp, the
same technique checker.py already uses to find real created issues.

hall-wits-arena is a disposable fixture repo, not a real project — issues are
deleted outright rather than closed, so the repo and its board don't
accumulate garbage across every eval run indefinitely.

Bare invocation (no flags) deletes every issue found by either match.
Deleting the label before verifying strips it from any labeled issue the
delete pass missed, making a later --dry-run check permanently blind — always
dry-run before delete-label.

Token: HALL_WITS_ARENA_TOKEN env var
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

OWNER = "MockaSort-Studio"
REPO  = "hall-wits-arena"


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
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise RuntimeError(f"{method} {url} → {e.code}: {e.read().decode()}") from e


def gh_graphql(query, variables, token):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read())
    if result.get("errors"):
        raise RuntimeError(f"GraphQL errors: {result['errors']}")
    return result.get("data") or {}


def _paged(query, token, filter_fn=None):
    results = []
    page = 1
    while True:
        batch = gh("GET", f"/repos/{OWNER}/{REPO}/issues?{query}&state=all&per_page=100&page={page}",
                   token) or []
        if not batch:
            break
        results.extend(filter_fn(batch) if filter_fn else batch)
        page += 1
    return results


def list_issues(label, run_dir, token):
    enc = urllib.parse.quote(label, safe="")
    issues = _paged(f"labels={enc}", token)

    if run_dir:
        manifest_path = os.path.join(run_dir, "manifest.json")
        if os.path.exists(manifest_path):
            with open(manifest_path) as f:
                since = json.load(f)["provisioned_at"]
            since_enc = urllib.parse.quote(since, safe="")
            issues += _paged(f"since={since_enc}", token,
                              filter_fn=lambda batch: [i for i in batch if i.get("created_at", "") > since])

    seen = {}
    for i in issues:
        seen[i["number"]] = i
    return list(seen.values())


def delete_all(label, run_dir, token):
    issues = list_issues(label, run_dir, token)
    for issue in issues:
        gh_graphql(
            "mutation($id:ID!){deleteIssue(input:{issueId:$id}){clientMutationId}}",
            {"id": issue["node_id"]}, token,
        )
        print(f"  deleted #{issue['number']}: {issue['title'][:60]}")
    print(f"cleanup: {len(issues)} issue(s) deleted")


def verify_clean(label, run_dir, token):
    issues = list_issues(label, run_dir, token)
    if issues:
        print(f"ORPHANS: {len(issues)} issue(s) from this run still exist:")
        for i in issues:
            print(f"  #{i['number']}: {i['title'][:80]}")
        return False
    print("zero orphans — this run is clean")
    return True


def delete_label(label, token):
    label_path = f"/repos/{OWNER}/{REPO}/labels/{urllib.parse.quote(label, safe='')}"
    gh("DELETE", label_path, token)
    print(f"  label '{label}' deleted")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("run_id")
    p.add_argument("run_dir", nargs="?", default=None,
                    help="run directory containing manifest.json, for timestamp-based matching")
    p.add_argument("--dry-run", action="store_true",
                    help="verify zero issues remain from this run; exit 1 if any found")
    p.add_argument("--delete-label", action="store_true",
                    help="delete the run label — only call after --dry-run confirms clean")
    args = p.parse_args()

    token = os.environ.get("HALL_WITS_ARENA_TOKEN")
    if not token:
        sys.exit("error: HALL_WITS_ARENA_TOKEN not set")

    label = f"run:{args.run_id}"

    if args.dry_run:
        sys.exit(0 if verify_clean(label, args.run_dir, token) else 1)

    if args.delete_label:
        delete_label(label, token)
        return

    delete_all(label, args.run_dir, token)


if __name__ == "__main__":
    main()
