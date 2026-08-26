// KR 7.1 Item #362 — real gh api graphql write to a test Discussion,
// confirmed via mesh. Closes out both KR 7.1 metric bullets. Throwaway,
// disposable, ran against hall-wits-arena (has_discussions enabled for
// this), not the real Hall repo.

const main = await mesh.self();

// Prerequisite (done once, outside the actor): enabled Discussions on the
// sandbox repo, created a throwaway test Discussion via createDiscussion,
// captured its GraphQL node id.

const actor = await agents.create({
  name: "spike-crew-actor-discussion",
  runner: "pi",
  instructions: `You are a disposable spike actor for KR 7.1 Item #362. You have exactly one tool: bash.

The moment you receive any message on topic "spike.crew.362", do exactly this:
1. Run this exact command using your bash tool:
gh api graphql -f query='mutation{addDiscussionComment(input:{discussionId:"<DISCUSSION_NODE_ID>",body:"Posted by a live pi-fabric actor with tools:[\\"bash\\"] — KR 7.1 Item #362."}){comment{id url}}}'
2. Take the real JSON output and call:
mesh.publish({ topic: "spike.crew.362", kind: "reply", to: "${main.id}", text: "<the real comment url>", data: { rawOutput: "<the full real JSON output>" } })

Use the command's genuine output, never invent values. No other tool calls, no explanation. Then stop.`,
  topics: ["spike.crew.362"],   // per-dispatch-scoped topic — Item #361's
                                 // cross-talk finding: never reuse a topic
                                 // name across separate spike runs.
  tools: ["bash"],
  responseMode: "text",
  delivery: "mailbox",
});

const ping = await mesh.publish({ topic: "spike.crew.362", kind: "ping", to: actor.id, text: "ping" });

// Check back after a real pause (agents.status/agents.log), then:
// - confirm via mesh.read({ topic: "spike.crew.362" }) — match on
//   event.from.id (an object, not a bare string — a real bug hit while
//   verifying this run: comparing event.from directly to a string id
//   silently fails)
// - Main independently re-fetches the comment by its GraphQL node id
//   (gh api graphql query{node(id:...)...}) rather than trusting either
//   the actor's report or the mesh event's data field alone.

return { actorId: actor.id, pingSequence: ping.sequence };
