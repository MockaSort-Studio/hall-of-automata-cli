import { readFileSync } from "node:fs";
import { Type } from "typebox";
import { connectComm } from "./comm-client.mjs";

const config = JSON.parse(readFileSync(process.env.PI_CREW_WORKER_CONFIG, "utf8"));
let comm;
let replyContext;
let firstDelivery = true;
let deliveries = Promise.resolve();
const settledWaiters = [];
const nextSettled = () => new Promise((resolve) => settledWaiters.push(resolve));
const qualify = (id) =>
  config.comm?.namespace && !id.startsWith(`${config.comm.namespace}-`) ? `${config.comm.namespace}-${id}` : id;
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

export default function workerCommExtension(pi) {
  if (!config.comm) return;
  pi.registerTool({
    name: "comm_notify",
    label: "Communication: notify",
    description: "Notify a Crew recipient without requiring a reply.",
    parameters: Type.Object({ to: Type.String(), payload: Type.Unknown() }),
    execute: (_id, input) => result(requireComm().emit({ ...input, to: qualify(input.to), replyRequired: false })),
  });
  pi.registerTool({
    name: "comm_request",
    label: "Communication: request",
    description: "Send a Crew recipient a message that requires a reply.",
    parameters: Type.Object({ to: Type.String(), payload: Type.Unknown() }),
    execute: (_id, input) => result(requireComm().emit({ ...input, to: qualify(input.to), replyRequired: true })),
  });
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
  pi.registerTool({
    name: "comm_notify_many",
    label: "Communication: notify selected",
    description: "Notify selected Crew recipients.",
    parameters: Type.Object({ to: Type.Array(Type.String(), { minItems: 1 }), payload: Type.Unknown() }),
    execute: (_id, input) =>
      result(Promise.all(input.to.map((to) => requireComm().emit({ to: qualify(to), payload: input.payload })))),
  });
  pi.registerTool({
    name: "comm_notify_all",
    label: "Communication: notify all",
    description: "Notify Main and every other Crew member.",
    parameters: Type.Object({ payload: Type.Unknown() }),
    execute: (_id, input) =>
      result(requireComm().broadcast({ namespace: config.comm.namespace, payload: input.payload, includeMain: true })),
  });
  pi.on("agent_settled", () => {
    settledWaiters.splice(0).forEach((resolve) => resolve());
  });
  pi.on("session_start", async () => {
    comm = await connectComm(config.comm);
    comm.onDelivery((message) => {
      deliveries = deliveries.then(async () => {
        const settled = nextSettled();
        replyContext = message;
        await pi.sendUserMessage(deliveryPrompt(message), { deliverAs: "followUp" });
        await settled;
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
