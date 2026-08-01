"""External API helpers — GitHub content fetching."""
import base64
import json
import urllib.error
import urllib.request

ARENA_OWNER = "MockaSort-Studio"
ARENA_REPO  = "hall-wits-arena"

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
