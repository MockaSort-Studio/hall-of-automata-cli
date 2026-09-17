import { appendFileSync, readFileSync } from "node:fs";
import { Type } from "typebox";
import { connectComm } from "./comm-client.mjs";

const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const sdk = await import(config.sdkModule);
const startedAt = Date.now();
const toolStarts = new Map();
const estimate = (value) => Math.ceil(JSON.stringify(value ?? "").length / 4);
const log = (event) =>
  appendFileSync(config.logFile, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
const comm = config.comm ? await connectComm(config.comm) : undefined;
let replyContext = config.delivery;
const qualify = (id) =>
  config.comm?.namespace && !id.startsWith(`${config.comm.namespace}-`) ? `${config.comm.namespace}-${id}` : id;
const notifyTool =
  comm &&
  sdk.defineTool({
    name: "comm_notify",
    label: "Communication: notify",
    description: "Notify a Crew recipient without requiring a reply.",
    parameters: Type.Object({
      to: Type.String(),
      payload: Type.Unknown(),
    }),
    async execute(_id, input) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(await comm.emit({ ...input, to: qualify(input.to), replyRequired: false })),
          },
        ],
      };
    },
  });
const kickoffTool =
  comm &&
  sdk.defineTool({
    name: "comm_kickoff",
    label: "Communication: Crew kickoff",
    description: "Broadcast one structured bounded assignment for every listed Crew member.",
    parameters: Type.Object({
      assignments: Type.Array(Type.Object({ to: Type.String(), task: Type.String(), done: Type.String() }), {
        minItems: 1,
      }),
    }),
    async execute(_id, input) {
      const names = new Set(config.crewMembers ?? []);
      if (
        input.assignments.length !== names.size ||
        new Set(input.assignments.map((item) => item.to)).size !== names.size ||
        input.assignments.some((item) => !names.has(item.to))
      )
        throw new Error("Kickoff requires exactly one assignment for every Crew member.");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await comm.broadcast({
                namespace: config.comm.namespace,
                payload: { kind: "kickoff", goal: input.goal, context: input.context, assignments: input.assignments },
              }),
            ),
          },
        ],
      };
    },
  });
const notifyManyTool =
  comm &&
  sdk.defineTool({
    name: "comm_notify_many",
    label: "Communication: notify selected",
    description: "Notify the Lead and only named dependent Crew members.",
    parameters: Type.Object({ to: Type.Array(Type.String(), { minItems: 1 }), payload: Type.Unknown() }),
    async execute(_id, input) {
      const results = await Promise.all(
        input.to.map((to) => comm.emit({ to: qualify(to), payload: input.payload, replyRequired: false })),
      );
      return { content: [{ type: "text", text: JSON.stringify(results) }] };
    },
  });
const notifyAllTool =
  comm &&
  sdk.defineTool({
    name: "comm_notify_all",
    label: "Communication: notify all",
    description: "Notify Main and every other member of this Crew without requiring replies.",
    parameters: Type.Object({ payload: Type.Unknown() }),
    async execute(_id, input) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await comm.broadcast({ namespace: config.comm.namespace, payload: input.payload, includeMain: true }),
            ),
          },
        ],
      };
    },
  });
const requestTool =
  comm &&
  sdk.defineTool({
    name: "comm_request",
    label: "Communication: request",
    description: "Send a Crew recipient a message that requires a reply.",
    parameters: Type.Object({ to: Type.String(), payload: Type.Unknown() }),
    async execute(_id, input) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(await comm.emit({ ...input, to: qualify(input.to), replyRequired: true })),
          },
        ],
      };
    },
  });
const replyTool =
  comm &&
  sdk.defineTool({
    name: "comm_reply",
    label: "Communication: reply",
    description: "Reply to the current communication delivery.",
    parameters: Type.Object({ payload: Type.Unknown() }),
    async execute(_id, input) {
      if (!replyContext?.replyRequired) throw new Error("Current delivery does not require a reply");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await comm.emit({ to: replyContext.from, payload: input.payload, replyTo: replyContext.id }),
            ),
          },
        ],
      };
    },
  });
const runtime = await sdk.ModelRuntime.create();
const model = config.model ? runtime.getModel(...config.model.split("/")) : undefined;
const loader = new sdk.DefaultResourceLoader({
  cwd: config.extensionCwd,
  agentDir: sdk.getAgentDir(),
  additionalExtensionPaths: config.extensionPaths,
});
await loader.reload({ resolveProjectTrust: async () => true });
const { session } = await sdk.createAgentSession({
  cwd: config.cwd,
  modelRuntime: runtime,
  model,
  thinkingLevel: config.thinking,
  tools: notifyTool
    ? [
        ...config.tools,
        "comm_kickoff",
        "comm_notify",
        "comm_notify_many",
        "comm_notify_all",
        "comm_request",
        "comm_reply",
      ]
    : config.tools,
  customTools: notifyTool ? [kickoffTool, notifyTool, notifyManyTool, notifyAllTool, requestTool, replyTool] : [],
  resourceLoader: loader,
  sessionManager: sdk.SessionManager.inMemory(config.cwd),
});
const nativeTools = new Set(["read", "bash", "edit", "write", "grep", "find", "ls"]);
log({
  type: "agent_start",
  systemTokens: estimate(session.agent.state.systemPrompt),
  toolSchemaTokens: estimate(session.agent.state.tools),
  extensionDiagnostics: loader.getExtensions().diagnostics,
  extensions: loader.getExtensions().extensions.map((extension) => extension.path),
  context: session.getContextUsage(),
});
session.subscribe((event) => {
  if (event.type === "tool_execution_start") {
    toolStarts.set(event.toolCallId, Date.now());
    log({
      type: "tool_start",
      id: event.toolCallId,
      name: event.toolName,
      source: ["comm_notify", "comm_request", "comm_reply"].includes(event.toolName)
        ? "custom"
        : nativeTools.has(event.toolName)
          ? "native"
          : "extension",
      callTokens: estimate(event.args),
    });
  }
  if (event.type === "tool_execution_end") {
    log({
      type: "tool_end",
      id: event.toolCallId,
      name: event.toolName,
      source: event.toolName === "comm_emit" ? "custom" : nativeTools.has(event.toolName) ? "native" : "extension",
      resultTokens: estimate(event.result),
      elapsedMs: Date.now() - (toolStarts.get(event.toolCallId) ?? Date.now()),
      error: event.isError,
      errorMessage: event.isError
        ? String(event.result?.content?.[0]?.text ?? event.result?.message ?? "tool failed").slice(0, 500)
        : undefined,
    });
  }
  if (event.type === "turn_end") {
    const output = event.message.content
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .slice(0, 12000);
    log({ type: "turn", usage: event.message.usage, context: session.getContextUsage(), output });
  }
});
try {
  const initialTask = config.delivery
    ? `${config.task}\n\nCommunication delivery: ${JSON.stringify({ from: config.delivery.from, payload: config.delivery.payload, replyRequired: Boolean(config.delivery.replyRequired) })}`
    : config.task;
  let initialTurn = Promise.resolve();
  let deliveries = Promise.resolve();
  let initialized = false;
  const deliveryPrompt = (message, includeTask) => {
    const delivery = `Communication delivery: ${JSON.stringify({ from: message.from, payload: message.payload, replyRequired: Boolean(message.replyRequired) })}`;
    return includeTask ? `${config.task}\n\n${delivery}` : delivery;
  };
  if (config.resident) {
    comm.onDelivery((message) => {
      deliveries = deliveries.then(async () => {
        await initialTurn;
        replyContext = message;
        await session.prompt(deliveryPrompt(message, !initialized && config.initialTurn === "first-delivery"));
        initialized = true;
        await comm.acknowledge(message.id);
      });
    });
  }
  if (!config.resident || config.delivery || config.initialTurn === "startup") {
    initialTurn = session.prompt(initialTask);
    await initialTurn;
    initialized = true;
    if (config.delivery) await comm.acknowledge(config.delivery.id);
  }
  if (config.resident) {
    await new Promise((resolve) => process.once("SIGTERM", resolve));
    await deliveries;
  }
  log({ type: "agent_end", elapsedMs: Date.now() - startedAt, context: session.getContextUsage() });
} catch (error) {
  log({ type: "agent_error", message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
} finally {
  session.dispose();
  comm?.close();
}
