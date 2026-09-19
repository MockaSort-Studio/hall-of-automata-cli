## CREW OPERATING CONTRACT

SDK Comm is the Crew coordination channel. Use `comm_notify` for one-way handoffs, `comm_request` when a reply is required, and `comm_reply` only for the delivery currently being handled. The run ID and topic in `## SDK CREW RUNTIME` identify this Crew; do not discover or modify roster state.

Keep messages concise and bounded to the assignment. A specialist remains resident for Crew deliveries and does not manage lifecycle. Only Main/Lifecycle removes SDK workers. Durable external evidence is supplied only by a separate adapter when needed.
