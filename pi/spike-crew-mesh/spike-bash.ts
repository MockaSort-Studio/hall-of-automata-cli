// KR 7.1 Item #361 — bash tool grant on the mesh actor, trivial command.
// Extends Item #360's actor with tools: ["bash"]. Still throwaway, still
// disposable per the saga's Migration Strategy Stage 1.

const main = await mesh.self();

const actor = await agents.create({
  name: "spike-crew-actor-bash",
  runner: "pi",
  instructions: `You are a disposable spike actor for testing pi-fabric's tools:["bash"] grant (Hall of Automata KR 7.1, Item #361). You have exactly one tool available: bash.

The moment you receive any message on topic "spike.crew", do exactly this:
1. Run the shell command \`date -u +"%Y-%m-%dT%H:%M:%SZ"\` using your bash tool.
2. Take its real stdout output (the actual timestamp it printed) and call:
mesh.publish({ topic: "spike.crew", kind: "reply", to: "${main.id}", text: "<the real command output>", data: { command: "date -u +%Y-%m-%dT%H:%M:%SZ" } })

Use the command's genuine output, not a value you invent. No other tool calls, no explanation. Then stop.`,
  topics: ["spike.crew"],
  tools: ["bash"],
  responseMode: "text",
  delivery: "mailbox",
});

const ping = await mesh.publish({ topic: "spike.crew", kind: "ping", to: actor.id, text: "ping" });
// Check back after a real pause via agents.status({id}) then mesh.read — do
// not busy-loop (see Item #360's spike.ts for why).

// IMPORTANT — finding from this run: any other actor still subscribed to
// the same topic also receives this ping and activates, REGARDLESS of the
// "to" field. "to" is metadata on the event, not a subscription delivery
// filter — an already-subscribed actor gets every topic message. Reusing a
// generic topic name ("spike.crew") across separate spike runs caused the
// Item #360 actor to react again to a ping meant only for this one. For
// KR 7.3's real Crew: either scope topics per-dispatch (not a shared
// generic name), or every specialist's instructions must explicitly check
// the "to" field and ignore messages not addressed to them — the platform
// will not filter this for you.

return { actorId: actor.id, pingSequence: ping.sequence };
