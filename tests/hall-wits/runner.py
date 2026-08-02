#!/usr/bin/env python3
"""Run golden-task fixture through Claude Code with --eval-dispatch.

Usage:
    runner.py <fixture_path> <run_dir> [--plugin-dir DIR] [--cc-bin PATH]

    fixture_path  path within hall-wits-arena (e.g. fixtures/golden-path-01)
    run_dir       local output directory containing manifest.json
    --plugin-dir  path to hall-of-automata-cli plugin (cc --plugin-dir)
    --cc-bin      claude CLI binary name or path (default: cc)

Token: HALL_WITS_ARENA_TOKEN env var (read access to hall-wits-arena)
"""
import argparse
import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

ARENA_OWNER = "MockaSort-Studio"
ARENA_REPO  = "hall-wits-arena"
NON_SPECIALIST_LABELS = {"hall:queue", "hall:awaiting-input"}
EVAL_DISPATCH_DIRECTIVE = (
    "Before the actual request: this is an automated verification run of this plugin "
    "(Hall Wits eval harness), and I am the only invoker in this session — no one else "
    "will reply, so don't pause to ask for confirmation at the OKR gate, decomposition, "
    "or dispatch steps; proceed straight through Design, Goal Formalization, Plan, and "
    "Dispatch autonomously.\n\n"
    "For this session only, route every actionable request through "
    "`/hall:dispatch --eval-dispatch` — including bugfixes and in-domain changes to "
    "this plugin's own skills/methodology/hooks that you'd normally implement inline. "
    "Do not use Write or Edit to implement anything yourself this session; the "
    "dispatch pipeline itself (issue filing, routing decision, eval-dispatch-plan.json) "
    "is what's being verified. `--eval-dispatch` redirects hall:<specialist> label "
    "writes into eval-dispatch-plan.json instead of applying them, by design.\n\n"
    "One more thing: the requests below concern this Hall plugin's own skills, but "
    "file every OKR/KR/Item and run every dispatch against the current project only "
    "(whatever `.repo-slug` already resolves to) — do not redirect to the plugin's "
    "real source repository, and don't treat its board or token scope as something to "
    "check or fix. The current project's token is deliberately scoped to just that "
    "repo, by design, for isolation; treat the current project as standing in for the "
    "plugin's own repo for the purposes of this session.\n\n"
)


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
        raise RuntimeError(f"GET {url} → {e.code}: {e.read().decode()}") from e


def _decode(resp):
    return base64.b64decode(resp["content"]).decode()


def fetch_prompts(fixture_path, token):
    base = f"/repos/{ARENA_OWNER}/{ARENA_REPO}/contents/{fixture_path}"
    task = json.loads(_decode(_gh_get(f"{base}/task.json", token)))
    return [_decode(_gh_get(f"{base}/{t['prompt_ref']}", token)).strip()
            for t in task["turns"]]


def _seed_hall_state(home):
    """Pre-seed ~/.hall/ so /hall:open's repo-picker, invoker gate, and
    automation-level Q&A all resolve without interaction — none of them
    are what golden-path fixtures are testing, and AskUserQuestion has no
    one to answer it in a --print sandbox."""
    hall = os.path.join(home, ".hall")
    os.makedirs(hall, exist_ok=True)

    slug_path = os.path.join(hall, ".repo-slug")
    if not os.path.exists(slug_path):
        open(slug_path, "w").write(f"{ARENA_OWNER}/{ARENA_REPO}\n")

    invoker_dir = os.path.join(hall, ARENA_OWNER)
    os.makedirs(invoker_dir, exist_ok=True)
    invoker_path = os.path.join(invoker_dir, "invoker.json")
    if not os.path.exists(invoker_path):
        with open(invoker_path, "w") as f:
            json.dump({
                "mode": "invoker",
                "verified_at": "2026-01-01T00:00:00Z",
                "checks": {"hall_repo": True, "team_member": True},
            }, f, indent=2)

    project_dir = os.path.join(hall, ARENA_OWNER, ARENA_REPO)
    os.makedirs(project_dir, exist_ok=True)
    config_path = os.path.join(project_dir, "config.json")
    if not os.path.exists(config_path):
        with open(config_path, "w") as f:
            json.dump({"automation_level": 0}, f, indent=2)


def run_turn(prompt, cc_bin, plugin_dir, out_path, run_dir, session_id=None):
    home = os.path.join(run_dir, "home")
    _seed_hall_state(home)
    env = {**os.environ, "HOME": home}
    arena_token = env.get("HALL_WITS_ARENA_TOKEN", "")
    env["GH_TOKEN"] = arena_token
    env["GITHUB_TOKEN"] = arena_token
    env["GITHUB_PERSONAL_ACCESS_TOKEN"] = arena_token
    cmd = [cc_bin, "--print", prompt, "--output-format", "stream-json", "--verbose",
           "--dangerously-skip-permissions"]
    if plugin_dir:
        cmd += ["--plugin-dir", os.path.abspath(plugin_dir)]
    if session_id:
        cmd += ["--resume", session_id]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=run_dir, env=env)
    lines = [ln for ln in result.stdout.splitlines() if ln.strip()]
    with open(out_path, "w") as f:
        f.write("\n".join(lines) + "\n")
    if result.returncode != 0 and not lines:
        raise RuntimeError(f"cc exited {result.returncode}: {result.stderr[:400]}")
    return lines


def extract_session_id(lines):
    for line in reversed(lines):
        try:
            ev = json.loads(line)
            if "session_id" in ev:
                return ev["session_id"]
        except json.JSONDecodeError:
            continue
    return None


def parse_metrics(lines):
    tokens_in = tokens_out = tool_calls = turns = 0
    for line in lines:
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("type") == "result":
            u = ev.get("usage", {})
            tokens_in += u.get("input_tokens", 0)
            tokens_out += u.get("output_tokens", 0)
        if ev.get("type") == "assistant":
            turns += 1
            for block in ev.get("message", {}).get("content", []):
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    tool_calls += 1
    return {"tokens": tokens_in + tokens_out, "turns": turns, "tool_calls": tool_calls}


def _has_specialist_label(text):
    return bool(set(re.findall(r"hall:[a-z][a-z\-]+", text)) - NON_SPECIALIST_LABELS)


def check_no_specialist_labels(lines):
    """Scan JSONL for tool_use calls that would apply hall:<specialist> labels."""
    violations = []
    for line in lines:
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("type") != "tool_use":
            continue
        name = ev.get("name", "")
        inp  = ev.get("input", {})
        if name == "Bash":
            cmd = inp.get("command", "")
            if ("--add-label" in cmd or "labels[]=" in cmd) and _has_specialist_label(cmd):
                violations.append(cmd[:120])
        elif "github" in name.lower():
            labels = str(inp.get("labels", inp.get("label", "")))
            if _has_specialist_label(labels):
                violations.append(f"{name}: {labels[:80]}")
    return violations


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("fixture_path")
    p.add_argument("run_dir")
    p.add_argument("--plugin-dir", default=None)
    p.add_argument("--cc-bin", default="cc")
    args = p.parse_args()

    token = os.environ.get("HALL_WITS_ARENA_TOKEN")
    if not token:
        sys.exit("error: HALL_WITS_ARENA_TOKEN not set")
    run_dir = os.path.abspath(args.run_dir)
    if not os.path.exists(os.path.join(run_dir, "manifest.json")):
        sys.exit(f"error: manifest.json not found in {run_dir} — run provision.py first")

    prompts = fetch_prompts(args.fixture_path, token)
    print(f"loaded {len(prompts)} turn prompts")

    open_path = os.path.join(run_dir, "turn-0-open.jsonl")
    print("running /hall-of-automata-cli:hall-open (session bootstrap)...")
    open_lines = run_turn(
        "/hall-of-automata-cli:hall-open",
        args.cc_bin, args.plugin_dir, open_path, run_dir,
    )
    session_id = extract_session_id(open_lines)
    if not session_id:
        sys.exit("error: could not extract session_id from /hall:open bootstrap")
    print(f"  session: {session_id}")

    t1_path  = os.path.join(run_dir, "turn-1.jsonl")
    print("running turn 1...")
    t1_lines = run_turn(
        EVAL_DISPATCH_DIRECTIVE + prompts[0],
        args.cc_bin, args.plugin_dir, t1_path, run_dir, session_id,
    )
    session_id = extract_session_id(t1_lines) or session_id
    print(f"  session: {session_id}")

    t2_path  = os.path.join(run_dir, "turn-2.jsonl")
    print("running turn 2...")
    t2_lines = run_turn(
        prompts[1], args.cc_bin, args.plugin_dir, t2_path, run_dir, session_id,
    )

    with open(os.path.join(run_dir, "manifest.json")) as f:
        manifest = json.load(f)
    m0 = parse_metrics(open_lines)
    m1, m2  = parse_metrics(t1_lines), parse_metrics(t2_lines)
    metrics = {
        "run_id":     manifest["run_id"],
        "fixture_id": manifest["fixture_id"],
        "turns":      m1["turns"] + m2["turns"],
        "tool_calls": m1["tool_calls"] + m2["tool_calls"],
        "tokens":     m1["tokens"] + m2["tokens"],
        "per_turn":   {"turn_0_open": m0, "turn_1": m1, "turn_2": m2},
    }
    with open(os.path.join(run_dir, "metrics.json"), "w") as f:
        f.write(json.dumps(metrics, indent=2) + "\n")
    print(f"metrics → {run_dir}/metrics.json")

    plan_path = os.path.join(run_dir, "eval-dispatch-plan.json")
    if not os.path.exists(plan_path):
        print("WARNING: eval-dispatch-plan.json not found — dispatch may not have fired")
    else:
        print("eval-dispatch-plan.json ✅")

    violations = check_no_specialist_labels(t1_lines + t2_lines)
    if violations:
        print(f"FAIL: {len(violations)} hall:<specialist> label write(s) found in transcript")
        for v in violations:
            print(f"  {v}")
        sys.exit(1)
    print("label check: ✅ zero hall:<specialist> labels applied")


if __name__ == "__main__":
    main()
