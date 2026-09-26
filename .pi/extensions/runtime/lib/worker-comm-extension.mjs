import { readFileSync } from "node:fs";
import { Type } from "typebox";
import { connectComm } from "./comm-client.mjs";
import { staticContextTokens } from "../../crew/lib/observability-ledger.mjs";
import { isDegenerateTurn } from "./degenerate-turn.mjs";
import { RESOLVED_MODEL_MARKER, STATIC_CONTEXT_MARKER } from "./worker-events.mjs";

const config = JSON.parse(readFileSync(process.env.PI_CREW_WORKER_CONFIG, "utf8"));
let comm;
let replyContext;
let firstDelivery = true;
let deliveries = Promise.resolve();
const settledWaiters = [];
const nextSettled = () => new Promise((resolve) => settledWaiters.push(resolve));
// "main" is the one canonical, pre-registered actor id: it is never
// namespace-qualified, unlike every other Crew recipient handle.
const qualify = (id) =>
  id !== "main" && config.comm?.namespace && !id.startsWith(`${config.comm.namespace}-`)
    ? `${config.comm.namespace}-${id}`
    : id;
const result = async (operation) => ({ content: [{ type: "text", text: JSON.stringify(await operation) }] });
const deliveryPrompt = (message) => {
  const delivery = `Communication delivery: ${JSON.stringify({
    from: message.from,
    payload: message.payload,
    replyRequired: Boolean(message.replyRequired),
  })}`;
  return firstDelivery && config.initialTurn === "first-delivery" ? `${config.task}\n\n${delivery}` : delivery;
};
const requireComm = () => {
  if (!comm) throw new Error("Crew communication is not ready");
  return comm;
};
const granted = new Set(config.commTools ?? ["comm_notify", "comm_request", "comm_reply"]);

export default function workerCommExtension(pi) {
  let staticContextReported = false;
  // sawTurnEnd distinguishes "a turn_end fired and it was empty" (degenerate,
  // worth retrying) from "no turn_end fired at all before settling" (a
  // legitimate completion path, e.g. reply-driven -- must NOT be treated as
  // degenerate, or every such delivery would trigger a retry that awaits a
  // settle event that may never come again).
  let sawTurnEnd, lastTurnUsage, lastTurnToolCalls;
  pi.on("turn_end", (event) => {
    sawTurnEnd = true;
    lastTurnUsage = event.message?.usage;
    lastTurnToolCalls = (event.message?.content ?? []).filter((part) => part.type === "toolCall").length;
  });
  pi.on("agent_start", (_event, ctx) => {
    if (staticContextReported) return;
    staticContextReported = true;
    const active = new Set(pi.getActiveTools());
    const tools = pi
      .getAllTools()
      .filter((tool) => active.has(tool.name))
      .map(({ name, parameters }) => ({ name, parameters }));
    const tokens = staticContextTokens(ctx.getSystemPrompt(), tools);
    ctx.ui.notify(`${STATIC_CONTEXT_MARKER}${JSON.stringify(tokens)}`, "info");
    // Relay the worker's own actually-resolved model id: a worker launched
    // without an explicit --model flag inherits whatever default `pi
    // --mode rpc` resolves to, which the launch config never captures.
    // ctx.model is the one place that resolution is actually knowable, per
    // docs/extensions.md's `ctx.model` ("the active model").
    const modelId = ctx.model?.provider && ctx.model?.id ? `${ctx.model.provider}/${ctx.model.id}` : ctx.model?.id;
    const modelWindow = Number.isFinite(ctx.model?.contextWindow) ? ctx.model.contextWindow : undefined;
    if (modelId) ctx.ui.notify(`${RESOLVED_MODEL_MARKER}${JSON.stringify({ modelId, modelWindow })}`, "info");
  });
  if (!config.comm) return;
  pi.registerTool({
    name: "lifecycle_update",
    label: "Lifecycle: update current work state",
    description:
      "Set your typed work state. Use waiting only while pausing active work; terminal states are required at completion, block, or failure.",
    parameters: Type.Object({
      state: Type.Union([
        Type.Literal("running"),
        Type.Literal("waiting"),
        Type.Literal("complete"),
        Type.Literal("blocked"),
        Type.Literal("failed"),
      ]),
    }),
    execute: (_id, input) => result(requireComm().lifecycleUpdate(config.comm.namespace, input.state)),
  });
  if (granted.has("comm_notify"))
    pi.registerTool({
      name: "comm_notify",
      label: "Communication: notify",
      description: "Notify a Crew recipient without requiring a reply.",
      parameters: Type.Object({ to: Type.String(), payload: Type.Unknown() }),
      execute: (_id, input) => result(requireComm().emit({ ...input, to: qualify(input.to), replyRequired: false })),
    });
  if (granted.has("comm_request"))
    pi.registerTool({
      name: "comm_request",
      label: "Communication: request",
      description: "Send a Crew recipient a message that requires a reply.",
      parameters: Type.Object({ to: Type.String(), payload: Type.Unknown() }),
      execute: (_id, input) => result(requireComm().emit({ ...input, to: qualify(input.to), replyRequired: true })),
    });
  if (granted.has("comm_reply"))
    pi.registerTool({
      name: "comm_reply",
      label: "Communication: reply",
      description: "Reply to the current communication delivery.",
      parameters: Type.Object({ payload: Type.Unknown() }),
      execute: (_id, input) => {
        if (!replyContext?.replyRequired) throw new Error("Current delivery does not require a reply");
        return result(requireComm().emit({ to: replyContext.from, payload: input.payload, replyTo: replyContext.id }));
      },
    });
  if (granted.has("comm_notify_all"))
    pi.registerTool({
      name: "comm_notify_all",
      label: "Communication: notify all",
      description: "Notify Main and every other Crew member. Lead-only coordination broadcast.",
      parameters: Type.Object({ payload: Type.Unknown() }),
      execute: (_id, input) =>
        result(
          requireComm().broadcast({ namespace: config.comm.namespace, payload: input.payload, includeMain: true }),
        ),
    });
  pi.on("agent_settled", () => {
    settledWaiters.splice(0).forEach((resolve) => resolve());
  });
  pi.on("session_start", async () => {
    comm = await connectComm(config.comm);
    comm.onDelivery((message) => {
      deliveries = deliveries.then(async () => {
        replyContext = message;
        await comm.lifecycleUpdate(config.comm.namespace, "running");
        const prompt = deliveryPrompt(message);
        let settled = nextSettled();
        sawTurnEnd = false;
        await pi.sendUserMessage(prompt, { deliverAs: "followUp" });
        await settled;
        if (sawTurnEnd && isDegenerateTurn(lastTurnUsage, lastTurnToolCalls)) {
          settled = nextSettled();
          sawTurnEnd = false;
          await pi.sendUserMessage(prompt, { deliverAs: "followUp" });
          await settled;
          if (sawTurnEnd && isDegenerateTurn(lastTurnUsage, lastTurnToolCalls)) {
            try {
              await comm.emit({
                to: "main",
                payload: {
                  kind: "report",
                  status: "BLOCKED",
                  reason: "empty-turn",
                  detail: "Two consecutive empty provider turns (no tokens, no tool call) for this delivery.",
                },
              });
            } catch {}
          }
        }
        await comm.acknowledge(message.id);
        replyContext = undefined;
        firstDelivery = false;
      });
    });
  });
  pi.on("session_shutdown", async () => {
    await deliveries;
    comm?.close();
  });
}
