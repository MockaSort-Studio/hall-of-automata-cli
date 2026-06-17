# Prior context query (Step 3b)

For each task about to be dispatched, call `mcp__github__search_issues` on the target repo with `state: closed`. Retrieve the last 10 closed issues. Identify those relevant to the task being dispatched (same domain, same files, same feature area).

Include in the issue body a **Prior context** section when relevant. Omit the section entirely if no relevant prior issues exist. Do not fabricate context.
