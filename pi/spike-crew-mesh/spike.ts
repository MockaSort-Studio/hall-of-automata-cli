// KR 7.1 Item #360 — bare mesh round-trip between Main and one Pi actor.
// Throwaway spike per the saga's Migration Strategy Stage 1: not wired into
// any real Hall skill, disposable. Copy-adapted directly into a fabric_exec
// call; see RESULTS.md for the observed run this was validated against.

const main = await mesh.self();

const actor = await agents.create({
  name: "spike-crew-actor",
  runner: "pi",
  instructions: `You are a disposable spike actor for testing pi-fabric mesh coordination (Hall of Automata KR 7.1, Item #360). You have no tools and must not use bash, edit, write, or any filesystem operation.

The moment you receive any message on topic "spike.crew", your entire job is one call:
mesh.publish({ topic: "spike.crew", kind: "reply", to: "${main.id}", text: "pong", data: { repliedAt: new Date().toISOString() } })

Do this immediately, with no other tool calls, no explanation, no questions. Then stop.`,
  topics: ["spike.crew"],
  tools: [],
  responseMode: "text",
  delivery: "mailbox",
});

const publishedAtMs = Date.now();
const ping = await mesh.publish({ topic: "spike.crew", kind: "ping", to: actor.id, text: "ping" });

// Poll for the reply in a *separate* fabric_exec call after a real pause —
// a single call's rapid-fire polling loop finishes in well under a second,
// faster than the actor's real turnaround (~4.7s observed: mailbox delivery
// + one model turn + tool call). Don't busy-loop in one call expecting it
// to land; check back.
return { mainId: main.id, actorId: actor.id, pingSequence: ping.sequence, publishedAtMs };

// --- second call, after a real pause ---
// const events = await mesh.read({ topic: "spike.crew" });
// const reply = events.find(e => e.from === actorId && e.to === mainId);
