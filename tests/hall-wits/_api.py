"""External API helpers — GitHub content fetching and Anthropic judge invocation."""
import base64
import json
import re
import urllib.error
import urllib.request

ARENA_OWNER   = "MockaSort-Studio"
ARENA_REPO    = "hall-wits-arena"
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
