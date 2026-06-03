#!/usr/bin/env bash
# Background GitHub polling daemon for in-flight Hall tasks.
# Writes $HOME/.hall/watcher.pid on start.
# Polls every POLL_INTERVAL seconds (default 120).
# Pass --once to run a single check and exit.

set -euo pipefail

POLL_INTERVAL="${POLL_INTERVAL:-120}"
ONCE=false
[[ "${1:-}" == "--once" ]] && ONCE=true

CACHE="$HOME/.hall"
PID_FILE="$CACHE/watcher.pid"

echo $$ > "$PID_FILE"
$ONCE || trap 'rm -f "$PID_FILE"' EXIT

check_once() {
  python3 << 'PYEOF'
import json, subprocess, glob, os, re
from datetime import datetime, timezone

CACHE = os.path.expanduser('~/.hall')
EVENTS_FILE = f'{CACHE}/watcher-events.jsonl'
STATE_FILE  = f'{CACHE}/watcher-state.json'

def ts():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def gh(*args):
    r = subprocess.run(['gh'] + list(args), capture_output=True, text=True, timeout=15)
    if r.returncode != 0 or not r.stdout.strip():
        return None
    return json.loads(r.stdout)

def emit(obj):
    line = f"[{obj['ts']}] {obj['event']} issue=#{obj['issue']}"
    if obj.get('pr'):
        line += f" pr=#{obj['pr']}"
    if obj.get('title'):
        line += f' title="{obj["title"]}"'
    print(line, flush=True)
    with open(EVENTS_FILE, 'a') as f:
        f.write(json.dumps(obj) + '\n')

# Plan discovery — fallback chain: plan.json -> plan.md -> give up
plan_dirs = sorted(glob.glob(f'{CACHE}/plans/*/'))
if not plan_dirs:
    exit(0)
plan_dir = plan_dirs[-1]

repo = ''
issues = []
plan_json_path = f'{plan_dir}/plan.json'
plan_md_path   = f'{plan_dir}/plan.md'
active_plan    = {'tasks': []}

if os.path.exists(plan_json_path):
    active_plan = json.load(open(plan_json_path))
    repo   = active_plan.get('repo', '')
    issues = [t['github_issue'] for t in active_plan.get('tasks', []) if t.get('github_issue')]

if (not repo or not issues) and os.path.exists(plan_md_path):
    content = open(plan_md_path).read()
    if not repo:
        m = re.search(r'\*\*Repo:\*\*\s+(\S+)|^repo:\s+(\S+)', content, re.M)
        if m:
            repo = m.group(1) or m.group(2)
    if not issues:
        issues = sorted(set(int(n) for n in re.findall(r'\[#(\d+)\]', content)))

if not repo or not issues:
    print('watcher: no trackable issues found', flush=True)
    exit(0)

# Load prior state
state     = json.load(open(STATE_FILE)) if os.path.exists(STATE_FILE) else {}
new_state = dict(state)

for n in issues:
    key  = str(n)
    prev = state.get(key, {})
    cur  = {}

    issue_data = gh('issue', 'view', str(n), '--repo', repo, '--json', 'state,labels,title')
    if not issue_data:
        new_state[key] = prev
        continue

    labels = [l['name'] for l in issue_data.get('labels', [])]
    title  = issue_data.get('title', '')
    cur['labels'] = labels

    prev_labels = set(prev.get('labels', []))
    cur_labels  = set(labels)

    for event_key, label in [
        ('LABEL_IN_PROGRESS',    'hall:in-progress'),
        ('LABEL_AWAITING_INPUT', 'hall:awaiting-input'),
        ('LABEL_POST_MORTEM',    'hall:post-mortem'),
    ]:
        if label in cur_labels and label not in prev_labels:
            emit({'ts': ts(), 'event': event_key, 'issue': n, 'title': title})

    pr_list = gh('pr', 'list', '--repo', repo, '--search', f'closes #{n}',
                 '--json', 'number,state,mergedAt,headRefName,commits')
    prs = pr_list if isinstance(pr_list, list) else []

    if prs:
        pr       = prs[0]
        pr_num   = pr.get('number')
        pr_state = pr.get('state', '')
        merged_at = pr.get('mergedAt')
        commits  = pr.get('commits', [])
        head_sha = commits[-1]['oid'] if commits else ''

        cur.update({'pr_num': pr_num, 'pr_state': pr_state,
                    'merged_at': merged_at, 'head_sha': head_sha})

        prev_pr_num   = prev.get('pr_num')
        prev_merged_at = prev.get('merged_at')
        prev_head_sha  = prev.get('head_sha', '')
        prev_pr_state  = prev.get('pr_state', '')

        if pr_num and not prev_pr_num and pr_state == 'open':
            emit({'ts': ts(), 'event': 'PR_OPENED', 'issue': n, 'pr': pr_num, 'title': title})
        if merged_at and not prev_merged_at:
            emit({'ts': ts(), 'event': 'PR_MERGED', 'issue': n, 'pr': pr_num, 'title': title})
        if pr_state == 'closed' and not merged_at and prev_pr_state != 'closed':
            emit({'ts': ts(), 'event': 'PR_CLOSED_NO_MERGE', 'issue': n, 'pr': pr_num, 'title': title})

        # REFINE_READY: new commit on PR branch while task is REVIEWING, review_cycle=1
        for task in active_plan.get('tasks', []):
            if (task.get('github_issue') == n
                    and task.get('status') == 'REVIEWING'
                    and task.get('review_cycle', 1) == 1
                    and head_sha and prev_head_sha
                    and head_sha != prev_head_sha):
                emit({'ts': ts(), 'event': 'REFINE_READY', 'issue': n, 'pr': pr_num, 'title': title})
    else:
        cur['pr_num'] = None

    new_state[key] = cur

os.makedirs(CACHE, exist_ok=True)
with open(STATE_FILE, 'w') as f:
    json.dump(new_state, f, indent=2)
PYEOF
}

if $ONCE; then
  check_once
  exit 0
fi

while true; do
  check_once 2>/dev/null || true
  sleep "$POLL_INTERVAL"
done
