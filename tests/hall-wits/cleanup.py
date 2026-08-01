#!/usr/bin/env python3
"""Close run-tagged issues in hall-wits-arena; verify and delete the run label.

Usage: cleanup.py <run_id> [--dry-run | --delete-label]

    run_id          short run identifier (e.g. run-a3f9c1)
    --dry-run       verify zero open issues under the run label; exit 1 if any found
    --delete-label  delete the run label — only call after --dry-run confirms clean

Bare invocation (no flags) closes all open run-tagged issues. Deleting the
label before verifying strips it from any issue the close pass missed,
making a later --dry-run check permanently blind — always dry-run before
delete-label.

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


def list_issues(label, token):
    enc = urllib.parse.quote(label, safe="")
    all_issues = []
    page = 1
    while True:
        batch = gh("GET",
                   f"/repos/{OWNER}/{REPO}/issues?labels={enc}&state=all&per_page=100&page={page}",
                   token) or []
        if not batch:
            break
        all_issues.extend(batch)
        page += 1
    return all_issues


def close_all(label, token):
    issues = list_issues(label, token)
    open_issues = [i for i in issues if i.get("state") == "open"]
    for issue in open_issues:
        gh("PATCH", f"/repos/{OWNER}/{REPO}/issues/{issue['number']}", token,
           {"state": "closed", "state_reason": "completed"})
        print(f"  closed #{issue['number']}: {issue['title'][:60]}")
    print(f"cleanup: {len(open_issues)} issue(s) closed")


def verify_clean(label, token):
    issues = list_issues(label, token)
    open_issues = [i for i in issues if i.get("state") == "open"]
    if open_issues:
        print(f"ORPHANS: {len(open_issues)} open issue(s) with label '{label}':")
        for i in open_issues:
            print(f"  #{i['number']}: {i['title'][:80]}")
        return False
    print(f"zero orphans — label '{label}' is clean")
    return True


def delete_label(label, token):
    label_path = f"/repos/{OWNER}/{REPO}/labels/{urllib.parse.quote(label, safe='')}"
    gh("DELETE", label_path, token)
    print(f"  label '{label}' deleted")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("run_id")
    p.add_argument("--dry-run", action="store_true",
                    help="verify zero open issues under the run label; exit 1 if any found")
    p.add_argument("--delete-label", action="store_true",
                    help="delete the run label — only call after --dry-run confirms clean")
    args = p.parse_args()

    token = os.environ.get("HALL_WITS_ARENA_TOKEN")
    if not token:
        sys.exit("error: HALL_WITS_ARENA_TOKEN not set")

    label = f"run:{args.run_id}"

    if args.dry_run:
        sys.exit(0 if verify_clean(label, token) else 1)

    if args.delete_label:
        delete_label(label, token)
        return

    close_all(label, token)


if __name__ == "__main__":
    main()
