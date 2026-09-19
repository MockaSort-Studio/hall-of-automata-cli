# Comm-native kickoff and dependency design

## Implemented flow

The Lead sends one `comm_kickoff` broadcast to Crew actors only. It contains a
shared goal, relevant context, and one assignment per local member handle:

```text
to, task, done, dependsOn[]
```

Workers execute independent assignments immediately and wait for directed
completion messages from prerequisites. Completion reaches the Lead and direct
dependents only. Kickoff does not reach Main; terminal `comm_notify_all` does.

## Remaining dependency work

- Make waiting and release a deterministic worker state machine.
- Validate handles, reject cycles, and report unsatisfied dependencies.
- Define failed-dependency timeout, retry, and blocked behavior.
- Add an end-to-end parallel-root and chained-release test.

## CommAdapter

A CommAdapter is a controller-side projection of ordinary Comm exchanges. It is
not a worker tool and does not create another agent-coordination protocol.

```text
CommController.emit(envelope) → adapter(message) → external channel
external human message → adapter → CommController.injectHuman(message)
```

The adapter host selects a factory by `config.id` and starts it with the
controller and adapter-specific config:

```ts
type AdapterMessage = {
  id: string;
  kind: "notify" | "request" | "reply";
  from: string;
  to: string;
  message: string;
  replyTo?: string;
};

type CommAdapterFactory = (
  controller: {
    subscribe(handler: (message: AdapterMessage) => void): () => void;
    injectHuman(input: { to: string; body: string; author?: string; externalId?: string }): {
      accepted: true;
      id: string;
    };
  },
  config: unknown,
) => Promise<{ stop(): Promise<void> }>;
```

Comm retains its full internal envelope for worker delivery. Before calling an
adapter, the controller projects only the fields above. It extracts the first
plain human-readable value from `payload.message`, `summary`, `report`,
`content`, `finding`, `findings`, or `evidence`; it never renders raw JSON.
`id` and `replyTo` retain request/reply threading.

A new channel adds a factory to `adapter-host.mjs`; Telegram and a custom UI use
the same `subscribe()` and `injectHuman()` boundary.

### Raw envelope observation

Internal runtime observers (e.g. a future dependency ledger) need more than an
adapter: payload `kind`, kickoff assignments, and other structured fields that
the human-readable projection above drops. `CommController.observeRaw(handler)`
subscribes to the full flat V1 envelope, unfiltered, alongside `subscribe()`.
Both read from the same `comm-envelope-observation.mjs` module so the
controller itself does not grow as ledger/DAG concerns are added.

## GitHub Discussion adapter

Each Crew run starts `github-discussion` by default; set `githubDiscussion: false`
to opt out. It creates or recovers one run Discussion:

```text
Crew - <run UUID> - <YYYY-MM-DD>
```

The adapter persists the Discussion identity and comment-poll cursor in its
run-local state file. It maps each Comm request ID to the GitHub comment node ID.
A notify or request is a top-level comment; a Comm reply is posted beneath the
mapped request.

```md
@architect-hamlet-00

Plain message.

lead-old-major-00
```

Replies omit the recipient mention and contain only the message and sender
signature. Human input follows the inverse mapping:

- `@architect-hamlet-00 message` targets that exact Crew handle.
- A comment without a target goes to the Lead.
- There is no human broadcast command.

Adapter-authored comments carry an invisible Comm marker and are ignored during
polling, preventing echo. Human input becomes an ordinary correlated Comm
request, so `comm_reply` renders under the original human comment.
