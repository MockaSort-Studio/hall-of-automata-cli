# pi-git-extension

Dependency-free Node CLI wrapping the GitHub state-model operations Hall's Pi
migration needs, on top of the `gh` CLI's existing auth. Built for KR 7.1 (#356)
Item #363 — replaces repeated raw `gh api` calls with tested, live-resolved
commands. No local cache anywhere — GitHub is the sole source of truth,
every id (field, category, discussion node) is resolved fresh on every call.

Run with `node cli.mjs <group> <action> --flag value ...`. All flags are
`--key value`; repeat `--label` for multiple labels.

```
issue create --repo org/repo --title "..." --body-file path [--label x ...] [--milestone "..."]
issue view   --repo org/repo --number 123

subissue add  --repo org/repo --parent 356 --child 360
subissue list --repo org/repo --parent 356

dep add --repo org/repo --issue 361 --blocked-by 360

project add-item   --org ORG --project 8 --url <issue-url>
project item-id    --org ORG --project 8 --number 360
project set-field  --org ORG --project 8 --item <itemId> --field Status --value Todo

discussion create        --owner ORG --repo repo --title "..." --body "..." --category General
discussion comment        --owner ORG --repo repo --number 5 --body "text"
discussion list-comments  --owner ORG --repo repo --number 5 [--limit 20]
discussion delete         --owner ORG --repo repo --number 5

repo set-discussions --repo org/repo --enabled true
```
