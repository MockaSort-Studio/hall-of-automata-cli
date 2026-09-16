import { appendFileSync, readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const sdk = await import(config.sdkModule);
const startedAt = Date.now();
const toolStarts = new Map();
const estimate = (value) => Math.ceil(JSON.stringify(value ?? "").length / 4);
const log = (event) =>
  appendFileSync(config.logFile, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
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
  tools: config.tools,
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
      source: nativeTools.has(event.toolName) ? "native" : "extension",
      callTokens: estimate(event.args),
    });
  }
  if (event.type === "tool_execution_end") {
    log({
      type: "tool_end",
      id: event.toolCallId,
      name: event.toolName,
      source: nativeTools.has(event.toolName) ? "native" : "extension",
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
  await session.prompt(config.task);
  log({ type: "agent_end", elapsedMs: Date.now() - startedAt, context: session.getContextUsage() });
} catch (error) {
  log({ type: "agent_error", message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
} finally {
  session.dispose();
}
