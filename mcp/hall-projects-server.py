#!/usr/bin/env python3
"""Hall Projects MCP server — GitHub Projects v2 GraphQL operations via FastMCP."""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from typing import Optional

from mcp.server.fastmcp import FastMCP
from _queries import GET_PROJECT_META, LIST_ITEMS, UPDATE_FIELD, ADD_COMMENT

_token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN")
if not _token:
    sys.exit("ERROR: GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN not set")

mcp = FastMCP("hall-projects")

_CACHE = ".hall-cache/session"
_BOARD_META = f"{_CACHE}/board-meta.json"
_BOARD = f"{_CACHE}/board.json"


def _graphql(query: str, variables: dict) -> dict:
    try:
        r = subprocess.run(
            ["gh", "api", "graphql", "--input", "-"],
            input=json.dumps({"query": query, "variables": variables}),
            capture_output=True, text=True, timeout=30,
        )
    except subprocess.TimeoutExpired:
        return {"error": "timeout"}
    if r.returncode != 0:
        return {"error": "subprocess_error", "stderr": r.stderr.strip()}
    try:
        data = json.loads(r.stdout)
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
        "assignees": [a["login"] for a in c.get("assignees", {}).get("nodes", [])],
        "labels": [lb["name"] for lb in c.get("labels", {}).get("nodes", [])],
        "fields": _extract_fields(node.get("fieldValues", {}).get("nodes", [])),
    }


@mcp.tool()
def get_project_meta(owner: str, project_number: int) -> dict:
    """Resolve project ID and all field/option IDs; persist to board-meta.json."""
    raw = _graphql(GET_PROJECT_META, {"owner": owner, "number": project_number})
    if "error" in raw:
        return raw
    try:
        meta = _parse_meta(raw)
    except (KeyError, TypeError) as e:
        sys.exit(f"Unrecoverable: empty meta response — {e}")
    os.makedirs(_CACHE, exist_ok=True)
    json.dump(meta, open(_BOARD_META, "w"), indent=2)
    return meta


@mcp.tool()
def list_items(project_id: str, cursor: Optional[str] = None) -> dict:
    """Fetch one page (up to 100 items) from a project; caller paginates via pageInfo."""
    variables: dict = {"projectId": project_id, "cursor": cursor}
    raw = _graphql(LIST_ITEMS, variables)
    if "error" in raw:
        return raw
    try:
        page = raw["data"]["node"]["items"]
        return {"items": page["nodes"], "pageInfo": page["pageInfo"]}
    except (KeyError, TypeError) as e:
        return {"error": "parse_error", "detail": str(e)}


@mcp.tool()
def update_item_field(
    project_id: str,
    item_id: str,
    field_id: str,
    value: dict,
    invoker_login: str,
) -> dict:
    """Update one field on one item; rejects if Invoker field doesn't match invoker_login."""
    if os.path.exists(_BOARD):
        try:
            board = json.load(open(_BOARD))
            item = next((i for i in board.get("items", []) if i["id"] == item_id), None)
            if item is not None:
                item_invoker = item.get("fields", {}).get("Invoker", "")
                if item_invoker != invoker_login:
                    return {
                        "error": "invoker_mismatch",
                        "item_invoker": item_invoker,
                        "requested_by": invoker_login,
                    }
        except (json.JSONDecodeError, KeyError):
            return {"error": "board_parse_error"}
    else:
        return {"error": "board_not_loaded", "hint": "call read_board first"}
    raw = _graphql(UPDATE_FIELD, {
        "projectId": project_id, "itemId": item_id,
        "fieldId": field_id, "value": value,
    })
    if "error" in raw:
        return raw
    return {"updated": item_id}


@mcp.tool()
def post_comment(issue_id: str, body: str) -> dict:
    """Post a comment on a linked issue; permitted on items owned by any invoker."""
    raw = _graphql(ADD_COMMENT, {"issueId": issue_id, "body": body})
    if "error" in raw:
        return raw
    try:
        node = raw["data"]["addComment"]["commentEdge"]["node"]
        return {"id": node["id"], "url": node["url"]}
    except (KeyError, TypeError) as e:
        return {"error": "parse_error", "detail": str(e)}


@mcp.tool()
def read_board(owner: str, project_number: int) -> dict:
    """Fetch full board (all pages), write board.json, return item count."""
    meta = get_project_meta(owner, project_number)
    if "error" in meta:
        sys.exit(f"Unrecoverable: cannot fetch project meta — {meta}")
    project_id = meta["project_id"]
    items = []
    cursor = None
    while True:
        page = list_items(project_id, cursor)
        if "error" in page:
            return page
        for node in page.get("items", []):
            built = _build_item(node)
            if built:
                items.append(built)
        if not page["pageInfo"]["hasNextPage"]:
            break
        cursor = page["pageInfo"]["endCursor"]
    board = {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "project_id": project_id,
        "items": items,
    }
    os.makedirs(_CACHE, exist_ok=True)
    json.dump(board, open(_BOARD, "w"), indent=2)
    return {"item_count": len(items), "project_id": project_id}


if __name__ == "__main__":
    mcp.run()
