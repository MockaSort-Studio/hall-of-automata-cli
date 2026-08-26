# pi-git-extension

Dependency-free Node CLI wrapping the GitHub state-model operations Hall's Pi
migration needs, on top of the `gh` CLI's existing auth. Built for KR 7.1 (#356)
Item #363 — replaces repeated raw `gh api` calls with tested, cached commands.

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

discussion comment --owner ORG --repo repo --number 5 --body "text"
```

Field/option ids for `project set-field` are resolved live from `field-list` on
every call — no local mirror of any GitHub state, per Saga 1's design law
(GitHub is the sole source of truth; nothing formalized gets cached to disk).
