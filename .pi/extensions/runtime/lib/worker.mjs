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
const commTool =
  comm &&
  sdk.defineTool({
    name: "comm_emit",
    label: "Communication: emit",
    description: "Emit one atomic payload to a Crew recipient.",
    parameters: Type.Object({ to: Type.String(), payload: Type.Unknown() }),
    async execute(_id, input) {
      return { content: [{ type: "text", text: JSON.stringify(await comm.emit(input)) }] };
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
  tools: commTool ? [...config.tools, "comm_emit"] : config.tools,
  customTools: commTool ? [commTool] : [],
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
      source: event.toolName === "comm_emit" ? "custom" : nativeTools.has(event.toolName) ? "native" : "extension",
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
    });
  }
  if (event.type === "turn_end") {
    log({ type: "turn", usage: event.message.usage, context: session.getContextUsage() });
  }
});
try {
  const initialTask = config.delivery
    ? `${config.task}\n\nCommunication delivery: ${JSON.stringify(config.delivery.payload)}`
    : config.task;
  await session.prompt(initialTask);
  if (config.resident) {
    let deliveries = Promise.resolve();
    comm.onDelivery((message) => {
      deliveries = deliveries.then(() => session.prompt(`Communication delivery: ${JSON.stringify(message.payload)}`));
    });
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
