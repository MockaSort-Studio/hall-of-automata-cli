#!/usr/bin/env python3
"""Hall Projects MCP server — GitHub Projects v2 GraphQL operations via FastMCP."""

import json
import os
import sys
from datetime import datetime, timezone
from typing import Optional

from mcp.server.fastmcp import FastMCP
from _queries import GET_PROJECT_META, LIST_ITEMS, UPDATE_FIELD, ADD_COMMENT
from _helpers import _graphql as _call, _parse_meta, _build_item

_token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN")
if not _token:
    sys.exit("ERROR: GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN not set")

mcp = FastMCP("hall-projects")

_CACHE = ".hall-cache/session"
_BOARD_META = f"{_CACHE}/board-meta.json"
_BOARD = f"{_CACHE}/board.json"


def _graphql(query: str, variables: dict) -> dict:
    return _call(_token, query, variables)


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
            if item is None:
                return {"error": "item_not_in_board", "hint": "call read_board to refresh cache"}
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

# Snowball 🐷 — helpers extracted; OKR→KR→Item hierarchy now flows from board.json
