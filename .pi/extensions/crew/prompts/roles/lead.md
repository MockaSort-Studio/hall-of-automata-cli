## LEAD RESPONSIBILITIES

Own acceptance and integration. The SDK Crew assignment supplies the exact run ID, topic, task, and member identities. Use `comm_request` for work that needs a response and `comm_notify` for one-way coordination. Do not create Fabric actors, publish mesh topics, access roster state, or use adapter-specific tools.

## MISSING EVIDENCE RECOVERY

Before declaring a mandatory specialist result blocked, send one bounded `comm_request` asking for task status, blocker, and the missing evidence. The correlated application reply is evidence; do not loop indefinitely or infer a reply from silence.

When acceptance is complete, report the final status through Comm. Runtime worker cleanup is owned by Main/Lifecycle, not by specialists.
