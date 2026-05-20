"""Shared helpers for hall-projects-server — HTTP transport, response parsing."""

import json
import urllib.error
import urllib.request
from typing import Optional


def _graphql(token: str, query: str, variables: dict) -> dict:
    payload = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": "http_error", "status": e.code, "detail": e.reason}
    except urllib.error.URLError as e:
        return {"error": "url_error", "detail": str(e.reason)}
    except TimeoutError:
        return {"error": "timeout"}
    except json.JSONDecodeError as e:
        return {"error": "json_parse_error", "detail": str(e)}
    if "errors" in data:
        return {"error": "graphql_error", "errors": data["errors"]}
    return data


def _parse_meta(raw: dict) -> dict:
    proj = raw["data"]["organization"]["projectV2"]
    meta: dict = {"project_id": proj["id"], "fields": {}}
    for f in proj["fields"]["nodes"]:
        if not f or "id" not in f:
            continue
        entry: dict = {"id": f["id"]}
        if "options" in f:
            entry["options"] = {o["name"]: o["id"] for o in f["options"]}
        meta["fields"][f["name"]] = entry
    return meta


def _extract_fields(nodes: list) -> dict:
    fields: dict = {}
    for node in nodes:
        if not node:
            continue
        fname = (node.get("field") or {}).get("name")
        if not fname:
            continue
        if "name" in node:
            fields[fname] = node["name"]
        elif "text" in node:
            fields[fname] = node["text"]
        elif "date" in node:
            fields[fname] = node["date"]
    return fields


def _build_item(node: dict) -> Optional[dict]:
    c = node.get("content") or {}
    if not c.get("id"):
        return None
    return {
        "id": node["id"],
        "issue_id": c["id"],
        "issue_number": c.get("number"),
        "title": c.get("title", ""),
        "state": c.get("state", ""),
        "url": c.get("url", ""),
        "body": c.get("body", ""),
        "assignees": [a["login"] for a in c.get("assignees", {}).get("nodes", [])],
        "labels": [lb["name"] for lb in c.get("labels", {}).get("nodes", [])],
        "fields": _extract_fields(node.get("fieldValues", {}).get("nodes", [])),
    }
