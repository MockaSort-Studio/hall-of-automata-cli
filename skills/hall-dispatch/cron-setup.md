# Schedule autonomous advancement cron (Step 7)

```bash
CRON_EXISTS=$([ -f ~/.hall/$SLUG/cron.json ] && echo true || echo false)
INFLIGHT=$(HALL_SLUG="$SLUG" python3 -c "import json,glob,os; slug=os.environ.get('HALL_SLUG',''); print('true' if any(any(t.get('status') in ('DISPATCHED','IN_PROGRESS') for t in json.load(open(f)).get('tasks',[])) for f in glob.glob(os.path.expanduser('~/.hall/' + slug + '/plans/*/plan.json'))) else 'false'" 2>/dev/null || echo "false")
```

If `CRON_EXISTS=false` and `INFLIGHT=true`: call `CronCreate` with:
- Schedule: `*/15 * * * *`
- Prompt: `"Autonomous plan advancement (cron): run /hall:reconcile. If any task has needs_review: true after reconcile, run /hall:review. If newly unlocked READY tasks exist, dispatch them without confirmation. Append one-line summary to ~/.hall/cron-log.md."`

Store the returned ID in `~/.hall/$SLUG/cron.json` as `{"cron_id":"<returned ID>","created_at":"<ISO timestamp>"}`.

If `CRON_EXISTS=false` and `INFLIGHT=false`: print `No in-flight tasks found — skipping cron creation.`

If `CRON_EXISTS=true`: print `Cron already active — skipping.`
